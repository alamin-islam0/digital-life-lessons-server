const express = require('express');
const router = express.Router();
const { verifyFirebaseToken, requireAuth } = require('../middleware/auth');
const Lesson = require('../models/Lesson');
const Favorite = require('../models/Favorite');
const Comment = require('../models/Comment');
const LessonReport = require('../models/LessonReport');
const User = require('../models/User');

// Helper functions
const getReadingTime = (text = '') => {
  const words = text.trim().split(/\s+/).length || 0;
  return Math.max(1, Math.ceil(words / 200)); // 200 wpm
};

const randomViews = () => Math.floor(Math.random() * 10000);

// Create lesson
router.post('/', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      emotionalTone,
      image,
      visibility = 'public',
      accessLevel = 'free',
    } = req.body;

    if (accessLevel === 'premium' && !req.dbUser.isPremium) {
      return res
        .status(403)
        .json({ message: 'Upgrade to Premium to create premium lessons' });
    }

    const lesson = await Lesson.create({
      title,
      description,
      category,
      emotionalTone,
      image,
      visibility,
      accessLevel,
      createdBy: req.dbUser._id,
      creatorName: req.dbUser.name,
      creatorPhoto: req.dbUser.photoURL,
      creatorEmail: req.dbUser.email,
    });

    await User.findByIdAndUpdate(req.dbUser._id, {
      $inc: { totalLessons: 1 },
    });

    res.status(201).json(lesson);
  } catch (err) {
    console.error('❌ POST /api/lessons error:', err);
    res.status(500).json({ message: 'Failed to create lesson' });
  }
});

// Public lessons listing with filter + search + sort + pagination
router.get('/public', async (req, res) => {
  try {
    const {
      category,
      emotionalTone,
      privacy,
      search,
      sort = 'newest',
      page = 1,
      limit = 10,
    } = req.query;

    const query = { visibility: 'public' };

    if (privacy) query.visibility = privacy;
    if (category) query.category = category;
    if (emotionalTone) query.emotionalTone = emotionalTone;
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    let mongoQuery = Lesson.find(query).select(
      'title description category emotionalTone creatorName creatorPhoto creatorEmail accessLevel visibility createdAt likesCount favoritesCount isFeatured'
    );

    if (sort === 'mostSaved') {
      mongoQuery = mongoQuery.sort({ favoritesCount: -1, createdAt: -1 });
    } else {
      mongoQuery = mongoQuery.sort({ createdAt: -1 });
    }

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    const skip = (pageNumber - 1) * pageSize;

    const [total, lessons] = await Promise.all([
      Lesson.countDocuments(query),
      mongoQuery.skip(skip).limit(pageSize),
    ]);

    res.json({
      total,
      page: pageNumber,
      limit: pageSize,
      lessons,
    });
  } catch (err) {
    console.error('❌ GET /api/lessons/public error:', err);
    res.status(500).json({ message: 'Failed to fetch public lessons' });
  }
});

// Featured lessons
router.get('/featured', async (req, res) => {
  try {
    const lessons = await Lesson.find({
      visibility: 'public',
      isFeatured: true,
    })
      .sort({ createdAt: -1 })
      .limit(6);

    res.json(lessons);
  } catch (err) {
    console.error('❌ GET /api/lessons/featured error:', err);
    res.status(500).json({ message: 'Failed to fetch featured lessons' });
  }
});

// Lessons by author
router.get('/author/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const lessons = await Lesson.find({
      createdBy: userId,
      visibility: 'public',
    }).sort({ createdAt: -1 });

    res.json(lessons);
  } catch (err) {
    console.error('❌ GET /api/lessons/author/:userId error:', err);
    res.status(500).json({ message: 'Failed to fetch author lessons' });
  }
});

// Get my lessons
router.get('/my', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    const lessons = await Lesson.find({ createdBy: req.dbUser._id }).sort({
      createdAt: -1,
    });
    res.json(lessons);
  } catch (err) {
    console.error('❌ GET /api/lessons/my error:', err);
    res.status(500).json({ message: 'Failed to fetch my lessons' });
  }
});

// Get user's favorites
router.get('/favorites', verifyFirebaseToken, requireAuth, async (req, res) => {
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
    console.error('❌ GET /api/lessons/favorites error:', err);
    console.error('Error details:', err.message);
    res.status(500).json({ message: 'Failed to fetch favorites', error: err.message });
  }
});

// Toggle favorite
router.post('/favorites/:lessonId', verifyFirebaseToken, requireAuth, async (req, res) => {
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
      // Add favorite
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
    console.error('❌ POST /api/lessons/favorites/:lessonId error:', err);
    console.error('Error details:', err.message);
    res.status(500).json({ message: 'Failed to toggle favorite', error: err.message });
  }
});

// Delete favorite (explicit removal)
router.delete('/favorites/:lessonId', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    const lessonId = req.params.lessonId;
    const userId = req.dbUser._id;

    const existing = await Favorite.findOne({
      user: userId,
      lesson: lessonId,
    });

    if (existing) {
      await Favorite.deleteOne({ _id: existing._id });
      await Lesson.findByIdAndUpdate(lessonId, {
        $inc: { favoritesCount: -1 },
      });
      await User.findByIdAndUpdate(userId, {
        $inc: { totalFavorites: -1 },
      });
      
      return res.json({ message: 'Favorite removed', favorited: false });
    } else {
      return res.status(404).json({ message: 'Favorite not found' });
    }
  } catch (err) {
    console.error('❌ DELETE /api/lessons/favorites/:lessonId error:', err);
    res.status(500).json({ message: 'Failed to remove favorite' });
  }
});

// Lesson details
router.get('/:id', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    // Premium gate
    const isOwner =
      lesson.createdBy.toString() === req.dbUser._id.toString();
    if (lesson.accessLevel === 'premium' && !req.dbUser.isPremium && !isOwner) {
      return res.status(403).json({
        message: 'Premium lesson - Upgrade to view',
        requiresUpgrade: true,
      });
    }

    const readingTime = getReadingTime(lesson.description);

    res.json({
      ...lesson.toObject(),
      readingTimeMinutes: readingTime,
      views: randomViews(),
    });
  } catch (err) {
    console.error('❌ GET /api/lessons/:id error:', err);
    res.status(500).json({ message: 'Failed to fetch lesson details' });
  }
});

// Update lesson
router.patch('/:id', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    const isOwner =
      lesson.createdBy.toString() === req.dbUser._id.toString();
    const isAdmin = req.dbUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not allowed to edit' });
    }

    const updatableFields = [
      'title',
      'description',
      'category',
      'emotionalTone',
      'image',
      'visibility',
      'accessLevel',
    ];

    updatableFields.forEach((field) => {
      if (field in req.body) {
        if (
          field === 'accessLevel' &&
          req.body[field] === 'premium' &&
          !req.dbUser.isPremium
        ) {
          return;
        }
        lesson[field] = req.body[field];
      }
    });

    await lesson.save();
    res.json(lesson);
  } catch (err) {
    console.error('❌ PATCH /api/lessons/:id error:', err);
    res.status(500).json({ message: 'Failed to update lesson' });
  }
});

// Delete lesson
router.delete('/:id', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    const isOwner =
      lesson.createdBy.toString() === req.dbUser._id.toString();
    const isAdmin = req.dbUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not allowed to delete' });
    }

    await Lesson.deleteOne({ _id: lesson._id });
    await Favorite.deleteMany({ lesson: lesson._id });
    await Comment.deleteMany({ lesson: lesson._id });
    await LessonReport.deleteMany({ lesson: lesson._id });

    await User.findByIdAndUpdate(lesson.createdBy, {
      $inc: { totalLessons: -1 },
    });

    res.json({ message: 'Lesson deleted successfully' });
  } catch (err) {
    console.error('❌ DELETE /api/lessons/:id error:', err);
    res.status(500).json({ message: 'Failed to delete lesson' });
  }
});

// Like / Unlike lesson
router.patch('/:id/like', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.dbUser._id;
    const lesson = await Lesson.findById(id);
    
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    const isLiked = lesson.likes.some(id => id.toString() === userId.toString());

    if (isLiked) {
      // User is UN-LIKING the lesson
      // 1. Remove user from lesson likes
      await Lesson.findByIdAndUpdate(id, { 
        $pull: { likes: userId },
        $inc: { likesCount: -1 }
      });
      
      // 2. Decrement totalLikes for the CURRENT USER (liker)
      await User.findByIdAndUpdate(userId, { 
        $inc: { totalLikes: -1 } 
      });
      
      res.json({ 
        success: true, 
        message: 'Unliked', 
        liked: false, 
        likesCount: Math.max(0, lesson.likesCount - 1) 
      });
    } else {
      // User is LIKING the lesson
      // 1. Add user to lesson likes
      await Lesson.findByIdAndUpdate(id, { 
        $addToSet: { likes: userId },
        $inc: { likesCount: 1 }
      });
      
      // 2. Increment totalLikes for the CURRENT USER (liker)
      await User.findByIdAndUpdate(userId, { 
        $inc: { totalLikes: 1 } 
      });
      
      res.json({ 
        success: true, 
        message: 'Liked', 
        liked: true, 
        likesCount: lesson.likesCount + 1 
      });
    }
  } catch (err) {
    console.error('❌ PATCH /api/lessons/:id/like error:', err);
    res.status(500).json({ message: 'Failed to toggle like', error: err.message });
  }
});

// Report lesson
router.post('/:id/report', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    const { reason, message } = req.body;
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    await LessonReport.create({
      lesson: lesson._id,
      reporter: req.dbUser._id,
      reason,
      message,
    });

    res.status(201).json({ message: 'Report submitted' });
  } catch (err) {
    console.error('❌ POST /api/lessons/:id/report error:', err);
    res.status(500).json({ message: 'Failed to submit report' });
  }
});

// Get comments
router.get('/:id/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ lesson: req.params.id })
      .populate('user', 'name photoURL')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (err) {
    console.error('❌ GET /api/lessons/:id/comments error:', err);
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
});

// Add comment
router.post('/:id/comments', verifyFirebaseToken, requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    const comment = await Comment.create({
      user: req.dbUser._id,
      lesson: lesson._id,
      text,
    });

    const populated = await comment.populate('user', 'name photoURL');
    res.status(201).json(populated);
  } catch (err) {
    console.error('❌ POST /api/lessons/:id/comments error:', err);
    res.status(500).json({ message: 'Failed to add comment' });
  }
});



module.exports = router;
