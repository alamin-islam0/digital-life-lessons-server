# Digital Life Lessons Server

A clean, modular Express.js backend for the Digital Life Lessons application.

## 📁 Project Structure

```
digital-life-lessons-server/
├── config/
│   └── firebase.js          # Firebase Admin initialization
├── middleware/
│   └── auth.js              # Authentication middleware
├── models/
│   ├── User.js              # User schema
│   ├── Lesson.js            # Lesson schema
│   ├── Favorite.js          # Favorite schema
│   ├── Comment.js           # Comment schema
│   └── LessonReport.js      # Report schema
├── routes/
│   ├── users.js             # User routes
│   ├── lessons.js           # Lesson CRUD & interactions
│   ├── favorites.js         # Favorites management
│   ├── dashboard.js         # Dashboard overview
│   ├── admin.js             # Admin panel routes
│   └── payment.js           # Stripe payment routes
├── index.js                 # Main server file
├── .env                     # Environment variables
└── package.json
```

## 🚀 API Endpoints

### **Authentication & Users**
- `POST /api/users/sync` - Sync user data after login
- `GET /api/users/me` - Get current user profile

### **Lessons**
- `POST /api/lessons` - Create a new lesson
- `GET /api/lessons/public` - Get public lessons (with filters, search, pagination)
- `GET /api/lessons/featured` - Get featured lessons
- `GET /api/lessons/author/:userId` - Get lessons by author
- `GET /api/lessons/my` - Get current user's lessons
- `GET /api/lessons/:id` - Get lesson details
- `PATCH /api/lessons/:id` - Update lesson
- `DELETE /api/lessons/:id` - Delete lesson
- `PATCH /api/lessons/:id/like` - Like/unlike lesson
- `POST /api/lessons/:id/report` - Report lesson
- `GET /api/lessons/:id/comments` - Get lesson comments
- `POST /api/lessons/:id/comments` - Add comment

### **Favorites**
- `POST /api/favorites/:lessonId` - Toggle favorite
- `GET /api/favorites/my` - Get user's favorites

### **Dashboard**
- `GET /api/dashboard/overview` - Get dashboard stats

### **Admin**
- `GET /api/admin/stats` - Get admin statistics
- `GET /api/admin/users` - Get all users
- `PATCH /api/admin/users/:id/role` - Update user role
- `GET /api/admin/lessons` - Get all lessons (with filters)
- `PATCH /api/admin/lessons/:id/feature` - Toggle featured status
- `DELETE /api/admin/lessons/:id` - Delete lesson
- `GET /api/admin/reported-lessons` - Get reported lessons
- `GET /api/admin/reported-lessons/:lessonId` - Get report details

### **Payment**
- `POST /api/payment/create-checkout-session` - Create Stripe checkout
- `POST /api/payment/webhook` - Stripe webhook handler

## 🔧 Environment Variables

```env
PORT=5001
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB_NAME=digital_life_lessons
CLIENT_URL=http://localhost:5173
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key
```

## 📦 Installation

```bash
npm install
```

## ▶️ Running the Server

```bash
# Development
node index.js

# Or with nodemon
npm install -g nodemon
nodemon index.js
```

## ✨ Features

- **Modular Architecture**: Clean separation of concerns with dedicated folders
- **Authentication**: Firebase Admin SDK integration
- **Authorization**: Role-based access control (user/admin)
- **Payment Integration**: Stripe checkout and webhooks
- **Database**: MongoDB with Mongoose ODM
- **Security**: Helmet, CORS, input validation
- **Error Handling**: Centralized error handling

## 🔐 Middleware

- `verifyFirebaseToken` - Validates Firebase JWT tokens
- `requireAuth` - Ensures user is authenticated
- `requireAdmin` - Ensures user has admin role

## 📊 Models

All models use Mongoose schemas with timestamps and proper relationships:
- **User**: Firebase UID, email, role, premium status
- **Lesson**: Title, description, category, emotional tone, visibility
- **Favorite**: User-Lesson relationship
- **Comment**: User comments on lessons
- **LessonReport**: User reports for inappropriate content
