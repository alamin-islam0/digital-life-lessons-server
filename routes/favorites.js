const express = require('express');
const router = express.Router();
const { verifyFirebaseToken, requireAuth } = require('../middleware/auth');
const Favorite = require('../models/Favorite');
const Lesson = require('../models/Lesson');
const User = require('../models/User');

// Toggle favorite
router.post('/:lessonId', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    const lessonId = req.params.lessonId;
    const userId = req.dbUser._id;

    const existing = await Favorite.findOne({
      user: userId,
      lesson: lessonId,
    });

    if (existing) {
      // Remove favorite
      await Favorite.deleteOne({ _id: existing._id });
      await Lesson.findByIdAndUpdate(lessonId, {
        $inc: { favoritesCount: -1 },
      });
      await User.findByIdAndUpdate(userId, {
        $inc: { totalFavorites: -1 },
      });

      return res.json({ favorited: false });
    } else {
      await Favorite.create({ user: userId, lesson: lessonId });
      await Lesson.findByIdAndUpdate(lessonId, {
        $inc: { favoritesCount: 1 },
      });
      await User.findByIdAndUpdate(userId, {
        $inc: { totalFavorites: 1 },
      });

      return res.json({ favorited: true });
    }
  } catch (err) {
    console.error('❌ POST /api/favorites/:lessonId error:', err);
    res.status(500).json({ message: 'Failed to toggle favorite' });
  }
});

// Get my favorites
router.get('/my', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    const { category, emotionalTone } = req.query;

    const favs = await Favorite.find({ user: req.dbUser._id }).populate({
      path: 'lesson',
      match: {
        ...(category ? { category } : {}),
        ...(emotionalTone ? { emotionalTone } : {}),
      },
    });

    const lessons = favs
      .filter((f) => f.lesson)
      .map((f) => f.lesson);

    res.json(lessons);
  } catch (err) {
    console.error('❌ GET /api/favorites/my error:', err);
    res.status(500).json({ message: 'Failed to fetch favorites' });
  }
});

module.exports = router;
