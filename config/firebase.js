const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const initializeFirebase = () => {
  if (!admin.apps.length) {
    try {
      let credential;
      const serviceAccountPath = path.join(__dirname, '..', 'digital-life-lessons-6d2b7-firebase-adminsdk-fbsvc-836beab639.json');

      if (fs.existsSync(serviceAccountPath)) {
        credential = admin.credential.cert(require(serviceAccountPath));
        console.log('✅ Firebase Admin initialized with service account file');
      } else {
        credential = admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            : undefined,
        });
        console.log('✅ Firebase Admin initialized with Environment Variables');
      }

      admin.initializeApp({
        credential,
      });
    } catch (err) {
      console.error('❌ Firebase Admin init error:', err.message);
    }
  }
};

module.exports = { initializeFirebase };
