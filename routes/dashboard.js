const express = require('express');
const router = express.Router();
const { verifyFirebaseToken, requireAuth } = require('../middleware/auth');
const Lesson = require('../models/Lesson');
const Favorite = require('../models/Favorite');


router.get('/overview', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    const [totalLessons, totalFavorites, recentLessons] = await Promise.all([
      Lesson.countDocuments({ createdBy: req.dbUser._id }),
      Favorite.countDocuments({ user: req.dbUser._id }),
      Lesson.find({ createdBy: req.dbUser._id })
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    res.json({
      totalLessons,
      totalFavorites,
      recentLessons,
    });
  } catch (err) {
    console.error('❌ GET /api/dashboard/overview error:', err);
    res.status(500).json({ message: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;
