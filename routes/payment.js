const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { verifyFirebaseToken, requireAuth } = require('../middleware/auth');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Create checkout session
router.post('/create-checkout-session', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    if (req.dbUser.isPremium) {
      return res
        .status(400)
        .json({ message: 'You are already a Premium user' });
    }

    const { successUrl, cancelUrl } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'bdt',
            unit_amount: 1500 * 100, // 1500 BDT in subunits
            product_data: {
              name: 'Digital Life Lessons Premium – Lifetime',
              description: 'One-time payment for lifetime premium access',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        firebaseUid: req.dbUser.firebaseUid,
        name: req.dbUser.name || '',
      },
      customer_email: req.dbUser.email,
      success_url:
        successUrl ||
        `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.CLIENT_URL}/payment/cancel`,
    });

    res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('❌ POST /api/payment/create-checkout-session error:', err);
    res.status(500).json({ message: 'Failed to create checkout session' });
  }
});

// Verify session after payment
router.post('/verify-session', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    // Check if payment already exists
    const Payment = require('../models/Payment');
    const existingPayment = await Payment.findOne({ stripeSessionId: sessionId });

    if (existingPayment) {
      // Payment already recorded
      return res.json({
        success: true,
        isPremium: true,
        message: 'Payment already verified',
        payment: {
          amount: existingPayment.amount,
          currency: existingPayment.currency,
          status: existingPayment.status,
          paymentDate: existingPayment.paymentDate,
        },
      });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if payment was successful
    if (session.payment_status === 'paid') {
      // Update user premium status if not already updated
      const User = require('../models/User');
      const user = await User.findOne({ 
        firebaseUid: req.dbUser.firebaseUid 
      });

      if (user && !user.isPremium) {
        user.isPremium = true;
        await user.save();
      }

      // Save payment record
      const payment = await Payment.create({
        user: req.dbUser._id,
        firebaseUid: req.dbUser.firebaseUid,
        email: req.dbUser.email,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent,
        amount: session.amount_total,
        currency: session.currency,
        status: 'completed',
        paymentMethod: session.payment_method_types?.[0] || 'card',
        customerName: session.customer_details?.name || req.dbUser.name,
        paymentDate: new Date(),
        metadata: {
          sessionMetadata: session.metadata,
          customerDetails: session.customer_details,
        },
      });

      return res.json({
        success: true,
        isPremium: true,
        message: 'Payment verified successfully',
        payment: {
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentDate: payment.paymentDate,
        },
      });
    } else {
      return res.json({
        success: false,
        isPremium: req.dbUser.isPremium,
        message: 'Payment not completed',
        paymentStatus: session.payment_status,
      });
    }
  } catch (err) {
    console.error('❌ POST /api/payment/verify-session error:', err);
    res.status(500).json({ message: 'Failed to verify session' });
  }
});

// Get user's payment history
router.get('/history', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    const Payment = require('../models/Payment');
    const payments = await Payment.find({ 
      user: req.dbUser._id 
    })
    .sort({ createdAt: -1 })
    .select('-metadata'); // Exclude metadata for cleaner response

    res.json(payments);
  } catch (err) {
    console.error('❌ GET /api/payment/history error:', err);
    res.status(500).json({ message: 'Failed to fetch payment history' });
  }
});

// Check premium status based on payments
router.get('/status', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    const Payment = require('../models/Payment');
    const User = require('../models/User');
    
    // Get user from database
    const user = await User.findOne({ firebaseUid: req.dbUser.firebaseUid });
    
    // Check if user has any completed payments
    const completedPayments = await Payment.countDocuments({
      user: req.dbUser._id,
      status: 'completed',
    });

    // Get latest payment
    const latestPayment = await Payment.findOne({
      user: req.dbUser._id,
      status: 'completed',
    }).sort({ createdAt: -1 });

    const isPremium = user?.isPremium || completedPayments > 0;

    res.json({
      isPremium,
      totalPayments: completedPayments,
      latestPayment: latestPayment ? {
        amount: latestPayment.amount,
        currency: latestPayment.currency,
        paymentDate: latestPayment.paymentDate,
      } : null,
    });
  } catch (err) {
    console.error('❌ GET /api/payment/status error:', err);
    res.status(500).json({ message: 'Failed to fetch payment status' });
  }
});

module.exports = router;

