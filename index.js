require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');


const { initializeFirebase } = require('./config/firebase');


initializeFirebase();


const {
  PORT = 5001,
  MONGODB_URI,
  CLIENT_URL,
  STRIPE_SECRET_KEY,
} = process.env;


if (!MONGODB_URI) {
  console.warn('⚠️ MONGODB_URI is not set in .env');
}
if (!STRIPE_SECRET_KEY) {
  console.warn('⚠️ STRIPE_SECRET_KEY is not set in .env');
}
if (!CLIENT_URL) {
  console.warn('⚠️ CLIENT_URL is not set in .env');
}


const app = express();


app.use(
  cors({
    origin: CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan('dev'));
app.use(cookieParser());

// ⚠️ Stripe webhook needs raw body BEFORE express.json
const Stripe = require('stripe');
const User = require('./models/User');
const Payment = require('./models/Payment');
const stripe = Stripe(STRIPE_SECRET_KEY);

app.post(
  '/api/payment/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
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

    
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const firebaseUid = session.metadata?.firebaseUid;
      const email = session.customer_details?.email;

      try {
        const user = await User.findOne({ firebaseUid });
        
        if (user) {
          
          user.isPremium = true;
          await user.save();
          
          
          await Payment.create({
            user: user._id,
            firebaseUid: user.firebaseUid,
            email: user.email,
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent,
            amount: session.amount_total,
            currency: session.currency,
            status: 'completed',
            paymentMethod: session.payment_method_types?.[0] || 'card',
            customerName: session.customer_details?.name || user.name,
            paymentDate: new Date(),
            metadata: {
              sessionMetadata: session.metadata,
              customerDetails: session.customer_details,
            },
          });
          
          console.log(`✅ Premium activated and payment saved for user: ${user.email}`);
        } else {
          console.warn('⚠️ Webhook: user not found for firebaseUid', firebaseUid);
          if (firebaseUid && email) {
            const newUser = await User.create({
              firebaseUid,
              email,
              isPremium: true,
              name: session.metadata?.name || 'Premium User',
            });
            
            
            await Payment.create({
              user: newUser._id,
              firebaseUid: newUser.firebaseUid,
              email: newUser.email,
              stripeSessionId: session.id,
              stripePaymentIntentId: session.payment_intent,
              amount: session.amount_total,
              currency: session.currency,
              status: 'completed',
              paymentMethod: session.payment_method_types?.[0] || 'card',
              customerName: session.customer_details?.name || newUser.name,
              paymentDate: new Date(),
              metadata: {
                sessionMetadata: session.metadata,
                customerDetails: session.customer_details,
              },
            });
          }
        }
      } catch (err) {
        console.error('❌ Error updating user premium status from webhook:', err);
        return res.status(500).json({ message: 'Server error in webhook' });
      }
    }

    res.json({ received: true });
  }
);


app.use(express.json({ limit: '10mb' }));


const userRoutes = require('./routes/users');
const lessonRoutes = require('./routes/lessons');
const favoriteRoutes = require('./routes/favorites');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payment');

app.use('/api/users', userRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);


app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Digital Life Lessons API is running',
  });
});


app.get('/favicon.ico', (req, res) => res.status(204).end());


app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});


app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err);
  res.status(500).json({ message: 'Internal Server Error' });
});


mongoose
  .connect(MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || 'digital_life_lessons',
  })
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
