const express = require('express');
const router = express.Router();
const { verifyFirebaseToken, requireAuth, requireAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Lesson = require('../models/Lesson');
const LessonReport = require('../models/LessonReport');
const Favorite = require('../models/Favorite');
const Comment = require('../models/Comment');

// Admin stats
router.get('/stats', verifyFirebaseToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalUsers, totalLessons, totalReports, todayLessons] =
      await Promise.all([
        User.countDocuments(),
        Lesson.countDocuments(), // Count ALL lessons (not just public)
        LessonReport.countDocuments(),
        Lesson.countDocuments({
          createdAt: { $gte: today },
        }),
      ]);

    res.json({
      totalUsers,
      totalLessons, // Now includes all lessons
      todayLessons,
      reportedLessons: totalReports, // Mapping to the requested key
    });
  } catch (err) {
    console.error('❌ GET /api/admin/stats error:', err);
    res.status(500).json({ message: 'Failed to fetch admin stats' });
  }
});

// Get all users
router.get('/users', verifyFirebaseToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error('❌ GET /api/admin/users error:', err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Update user role
router.patch('/users/:id/role', verifyFirebaseToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    console.error('❌ PATCH /api/admin/users/:id/role error:', err);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// Get all lessons
router.get('/lessons', verifyFirebaseToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { category, visibility, flagged } = req.query;

    const query = {};
    if (category) query.category = category;
    if (visibility) query.visibility = visibility;

    let lessons;
    if (flagged === 'true') {
      const reportedLessonIds = await LessonReport.distinct('lesson');
      query._id = { $in: reportedLessonIds };
    }

    lessons = await Lesson.find(query)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');

    res.json(lessons);
  } catch (err) {
    console.error('❌ GET /api/admin/lessons error:', err);
    res.status(500).json({ message: 'Failed to fetch lessons' });
  }
});

// Toggle lesson featured status
router.patch('/lessons/:id/feature', verifyFirebaseToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { isFeatured } = req.body;
    const lesson = await Lesson.findByIdAndUpdate(
      req.params.id,
      { isFeatured: !!isFeatured },
      { new: true }
    );
    res.json(lesson);
  } catch (err) {
    console.error('❌ PATCH /api/admin/lessons/:id/feature error:', err);
    res.status(500).json({ message: 'Failed to update feature status' });
  }
});

// Delete lesson (admin)
router.delete('/lessons/:id', verifyFirebaseToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    await Lesson.deleteOne({ _id: lesson._id });
    await Favorite.deleteMany({ lesson: lesson._id });
    await Comment.deleteMany({ lesson: lesson._id });
    await LessonReport.deleteMany({ lesson: lesson._id });

    res.json({ message: 'Lesson deleted by admin' });
  } catch (err) {
    console.error('❌ DELETE /api/admin/lessons/:id error:', err);
    res.status(500).json({ message: 'Failed to delete lesson' });
  }
});

// Get reported lessons
router.get('/reported-lessons', verifyFirebaseToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const reports = await LessonReport.aggregate([
      {
        $group: {
          _id: '$lesson',
          reportCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'lessons',
          localField: '_id',
          foreignField: '_id',
          as: 'lesson',
        },
      },
      { $unwind: '$lesson' },
    ]);

    res.json(reports);
  } catch (err) {
    console.error('❌ GET /api/admin/reported-lessons error:', err);
    res.status(500).json({ message: 'Failed to fetch reported lessons' });
  }
});

// Get report details for a lesson
router.get('/reported-lessons/:lessonId', verifyFirebaseToken, requireAuth, requireAdmin, async (req, res) => {
  try {
    const reports = await LessonReport.find({
      lesson: req.params.lessonId,
    })
      .populate('reporter', 'name email photoURL')
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (err) {
    console.error('❌ GET /api/admin/reported-lessons/:lessonId error:', err);
    res.status(500).json({ message: 'Failed to fetch report details' });
  }
});

module.exports = router;
