import admin from 'firebase-admin';
import { readFileSync } from 'fs';

let firebaseApp = null;

/**
 * Initializes Firebase Admin SDK
 * Should be called once at app startup
 */
export const initializeFirebaseAdmin = () => {
  // If an app is already initialized, reuse it and exit
  if (admin.apps.length) {
    firebaseApp = admin.app();
    console.log('Firebase Admin SDK already initialized, reusing existing app.');
    return;
  }

  try {
    const serviceAccountPath = process.env.FIREBASE_KEY_PATH;
    if (!serviceAccountPath) {
      throw new Error('FIREBASE_KEY_PATH is not defined in environment variables.');
    }
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error.message);
    // Re-throw the error to be caught by the caller in index.js
    throw error;
  }
};

/**
 * Gets Firebase Auth instance
 * @returns {admin.auth.Auth} Firebase Auth instance
 */
export const getFirebaseAuth = () => {
  if (!firebaseApp) {
    initializeFirebaseAdmin();
  }
  return admin.auth();
};
