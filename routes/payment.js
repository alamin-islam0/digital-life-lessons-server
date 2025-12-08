const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { verifyFirebaseToken, requireAuth } = require('../middleware/auth');
const User = require('../models/User');

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

// Webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const firebaseUid = session.metadata?.firebaseUid;
    const email = session.customer_details?.email;

    try {
      const user = await User.findOne({ firebaseUid });
      if (user) {
        user.isPremium = true;
        await user.save();
        console.log(`✅ Premium activated for user: ${user.email}`);
      } else {
        console.warn('⚠️ Webhook: user not found for firebaseUid', firebaseUid);
        if (firebaseUid && email) {
          await User.create({
            firebaseUid,
            email,
            isPremium: true,
            name: session.metadata?.name || 'Premium User',
          });
        }
      }
    } catch (err) {
      console.error('❌ Error updating user premium status from webhook:', err);
      return res.status(500).json({ message: 'Server error in webhook' });
    }
  }

  res.json({ received: true });
});

module.exports = router;
