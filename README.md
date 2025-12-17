# Digital Life Lessons - Server

This repository contains the backend server for the **Digital Life Lessons** platform. It is a robust RESTful API built with **Express.js** and **MongoDB**, utilizing **Firebase** for authentication and **Stripe** for premium payment processing.

## � Project Overview

The Digital Life Lessons server manages the core logic for a platform where users can share, discover, and learn from life lessons. It handles user authentication, content management (lessons), social interactions (likes, favorites, comments), and premium subscriptions.

## ✨ Key Features

### 🔐 Authentication & Users
- **Firebase Integration**: Secure user authentication verify via Firebase Admin SDK.
- **User Sync**: seamless synchronization between Firebase Auth and MongoDB user profiles.
- **Role-Based Access**: Distinction between standard `user` and `admin` roles.

### 📚 Lesson Management
- **CRUD Operations**: Complete Create, Read, Update, Delete functionality for lessons.
- **Advanced Filtering**: Filter public lessons by **Category**, **Emotional Tone**, and **Privacy**.
- **Search**: Text-based search for lesson titles.
- **Pagination**: Efficient data loading with pagination support.
- **Access Control**:
  - **Public/Private**: Users can keep lessons private or share them with the world.
  - **Free/Premium**: Premium content gating for monetized lessons.

### ❤️ Social Interactions
- **Likes**: Users can like and unlike lessons.
- **Favorites**: Users can save lessons to their personal collection.
- **Comments**: Community discussion on lessons.
- **Reporting**: Safety mechanism for users to report inappropriate content.

### 🛡️ Admin Dashboard
- **Statistics**: Overview of total users, lessons, and reports.
- **User Management**: View all users and update roles (promote/demote admins).
- **Content Moderation**: View reported lessons and take action (delete).
- **Featured Content**: Admins can mark lessons as "Featured" to highlight them.

### 💳 Payments (Stripe)
- **Premium Subscription**: One-time payment integration for lifetime premium access.
- **Stripe Checkout**: Secure payment processing via Stripe hosted pages.
- **Webhooks**: Automated handling of payment success events to update user status instantly.
- **Payment History**: Users can view their past transaction history.

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose ODM)
- **Authentication**: Firebase Admin SDK
- **Payments**: Stripe API
- **Security**: Helmet, CORS
- **Logging**: Morgan

## � API Documentation

### 👤 Users (`/api/users`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/sync` | Sync/Create user record from Firebase token | ✅ |
| `GET` | `/me` | Get current logged-in user details | ✅ |

### 📖 Lessons (`/api/lessons`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Create a new lesson | ✅ |
| `GET` | `/public` | Get all public lessons (Search, Filter, Paginate) | No |
| `GET` | `/featured` | Get featured lessons | No |
| `GET` | `/author/:userId` | Get public lessons by a specific author | No |
| `GET` | `/my` | Get current user's lessons | ✅ |
| `GET` | `/:id` | Get details of a specific lesson | ✅ |
| `PATCH` | `/:id` | Update a lesson (Owner/Admin only) | ✅ |
| `DELETE` | `/:id` | Delete a lesson (Owner/Admin only) | ✅ |
| `PATCH` | `/:id/like` | Like or Unlike a lesson | ✅ |
| `POST` | `/:id/report` | Report a lesson | ✅ |
| `GET` | `/:id/comments` | Get comments for a lesson | No |
| `POST` | `/:id/comments` | Add a comment to a lesson | ✅ |

### 🌟 Favorites (`/api/favorites`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/my` | Get current user's favorite lessons | ✅ |
| `POST` | `/:lessonId` | Toggle favorite status for a lesson | ✅ |

### 📊 Dashboard (`/api/dashboard`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/overview` | Get user stats (total lessons, favorites, recent activity) | ✅ |

### 🛡️ Admin (`/api/admin`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/stats` | Get platform-wide statistics | ✅ (Admin) |
| `GET` | `/users` | List all users | ✅ (Admin) |
| `PATCH` | `/users/:id/role` | Update user role (e.g., make admin) | ✅ (Admin) |
| `GET` | `/lessons` | List all lessons (with filters) | ✅ (Admin) |
| `PATCH` | `/lessons/:id/feature` | Toggle "Featured" status of a lesson | ✅ (Admin) |
| `DELETE` | `/lessons/:id` | Delete any lesson | ✅ (Admin) |
| `GET` | `/reported-lessons` | List aggregated reports | ✅ (Admin) |
| `GET` | `/reported-lessons/:lessonId` | Get detailed reports for a specific lesson | ✅ (Admin) |

### 💳 Payment (`/api/payment`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/create-checkout-session` | Initialize Stripe Checkout session | ✅ |
| `POST` | `/verify-session` | Verify payment status with Stripe | ✅ |
| `GET` | `/history` | Get user's payment history | ✅ |
| `GET` | `/status` | Check current premium status | ✅ |
| `POST` | `/webhook` | Stripe webhook handler (Raw Body) | No |

## � Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (Local or Atlas URI)
- Firebase Project (Service Account)
- Stripe Account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd digital-life-lessons-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   PORT=5001
   MONGODB_URI=your_mongodb_connection_string
   CLIENT_URL=http://localhost:5173
   
   # Firebase (Option 1: Service Account File)
   # Place your digital-life-lessons-...json file in the root or config folder
   # Code auto-detects specific filename in config/firebase.js
   
   # Firebase (Option 2: Environment Variables)
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_CLIENT_EMAIL=your_client_email
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
   
   # Stripe
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
   ```

4. **Run the server**
   ```bash
   # Development mode (with nodemon)
   npm run dev

   # Production mode
   npm start
   ```

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
