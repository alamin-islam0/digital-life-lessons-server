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

    const Payment = require('../models/Payment');
    const User = require('../models/User');

    // 1. Retrieve the session from Stripe
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (stripeErr) {
      console.error('❌ Stripe retrieve error:', stripeErr);
      return res.status(400).json({ message: 'Invalid Session ID', error: stripeErr.message });
    }

    if (!session) {
      return res.status(400).json({ message: 'Session not found' });
    }

    // 2. Security Check: payment_status
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ 
        message: 'Payment not completed', 
        status: session.payment_status 
      });
    }

    // 3. Duplicate Handling: Check by payment_intent (transactionId)
    // Most reliable way to detect if webhook already processed it
    const existingPayment = await Payment.findOne({
      $or: [
        { stripeSessionId: session.id },
        { stripePaymentIntentId: session.payment_intent }
      ]
    });

    if (existingPayment) {
      console.log('ℹ️ Payment already recorded:', existingPayment.stripeSessionId);
      return res.json({
        success: true,
        message: 'Payment already verified',
        payment: {
          amount: existingPayment.amount,
          currency: existingPayment.currency,
          status: existingPayment.status,
          paymentDate: existingPayment.paymentDate,
          transactionId: existingPayment.stripePaymentIntentId,
        },
      });
    }

    // 4. User Update: Find by session email
    const customerEmail = session.customer_details?.email || session.customer_email;
    let userToUpdate = await User.findOne({ email: customerEmail });
    
    // Fallback to logged-in user if email doesn't match or not found
    if (!userToUpdate) {
        console.warn(`⚠️ User with email ${customerEmail} not found, using logged-in user.`);
        userToUpdate = await User.findOne({ firebaseUid: req.dbUser.firebaseUid });
    }

    if (userToUpdate) {
        userToUpdate.isPremium = true;
        await userToUpdate.save();
    } else {
        return res.status(404).json({ message: 'User not found to update' });
    }

    // 5. Payment Record: Save transaction details
    const newPayment = await Payment.create({
      user: userToUpdate._id,
      firebaseUid: userToUpdate.firebaseUid,
      email: userToUpdate.email,
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent,
      amount: session.amount_total,
      currency: session.currency,
      status: 'completed',
      paymentMethod: session.payment_method_types?.[0] || 'card',
      customerName: session.customer_details?.name || userToUpdate.name,
      paymentDate: new Date(),
      metadata: {
        sessionMetadata: session.metadata,
        customerDetails: session.customer_details,
      },
    });

    // 6. Response
    res.json({
      success: true,
      message: 'Payment verified successfully',
      payment: {
        amount: newPayment.amount,
        currency: newPayment.currency,
        status: newPayment.status,
        paymentDate: newPayment.paymentDate,
        transactionId: newPayment.stripePaymentIntentId,
      },
    });

  } catch (err) {
    // Handle race condition: If duplicate key error (11000)
    if (err.code === 11000) {
      console.warn('⚠️ Race condition detected: Payment inserted by another process.');
      
      try {
        const Payment = require('../models/Payment');
        // Retrieve the existing payment that caused the conflict
        const existingPayment = await Payment.findOne({ stripeSessionId: req.body.sessionId });
        
        if (existingPayment) {
           return res.json({
            success: true,
            isPremium: true,
            message: 'Payment verified (duplicate handled)',
            payment: {
              amount: existingPayment.amount,
              currency: existingPayment.currency,
              status: existingPayment.status,
              paymentDate: existingPayment.paymentDate,
              transactionId: existingPayment.stripePaymentIntentId,
            },
          });
        }
      } catch (findErr) {
        console.error('❌ Error recovering from duplicate:', findErr);
      }
    }

    console.error('❌ POST /api/payment/verify-session error:', err);
    res.status(500).json({ message: 'Failed to verify session', error: err.message });
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

