const admin = require('firebase-admin');
const User = require('../models/User');

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: missing token' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.authUser = decoded;

    // Sync with MongoDB (single source of truth for role & isPremium)
    let user = await User.findOne({ firebaseUid: decoded.uid });
    if (!user) {
      user = await User.create({
        firebaseUid: decoded.uid,
        email: decoded.email,
        name: decoded.name || 'User',
        photoURL: decoded.picture || '',
      });
    }
    req.dbUser = user;
    next();
  } catch (err) {
    console.error('❌ verifyFirebaseToken error:', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const requireAuth = (req, res, next) => {
  if (!req.dbUser) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.dbUser || req.dbUser.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

module.exports = { verifyFirebaseToken, requireAuth, requireAdmin };
