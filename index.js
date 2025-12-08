require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

// Config
const { initializeFirebase } = require('./config/firebase');

// Initialize Firebase
initializeFirebase();

// Environment variables
const {
  PORT = 5001,
  MONGODB_URI,
  CLIENT_URL,
  STRIPE_SECRET_KEY,
} = process.env;

// Validate required environment variables
if (!MONGODB_URI) {
  console.warn('⚠️ MONGODB_URI is not set in .env');
}
if (!STRIPE_SECRET_KEY) {
  console.warn('⚠️ STRIPE_SECRET_KEY is not set in .env');
}
if (!CLIENT_URL) {
  console.warn('⚠️ CLIENT_URL is not set in .env');
}

// Initialize Express app
const app = express();

// Middleware
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
const paymentRoutes = require('./routes/payment');
app.use('/api/payment', paymentRoutes);

// JSON body parser for all other routes
app.use(express.json({ limit: '10mb' }));

// Routes
const userRoutes = require('./routes/users');
const lessonRoutes = require('./routes/lessons');
const favoriteRoutes = require('./routes/favorites');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');

app.use('/api/users', userRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Digital Life Lessons API is running',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Database connection and server start
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
