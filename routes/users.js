const express = require('express');
const router = express.Router();
const { verifyFirebaseToken, requireAuth } = require('../middleware/auth');
const User = require('../models/User');

// Sync user after login / register
router.post('/sync', verifyFirebaseToken, async (req, res) => {
  try {
    const { name, photoURL } = req.body || {};
    const user = await User.findOneAndUpdate(
      { firebaseUid: req.authUser.uid },
      {
        $set: {
          name: name || req.dbUser.name,
          photoURL: photoURL || req.dbUser.photoURL,
          email: req.authUser.email,
        },
      },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    console.error('❌ /api/users/sync error:', err);
    res.status(500).json({ message: 'Failed to sync user' });
  }
});

// Get current user
router.get('/me', verifyFirebaseToken, async (req, res) => {
  res.json(req.dbUser);
});

module.exports = router;
