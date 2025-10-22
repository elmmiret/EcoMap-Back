import admin from 'firebase-admin';
import { readFileSync } from 'fs';

let firebaseApp = null;

/**
 * Initializes Firebase Admin SDK
 * Should be called once at app startup
 */
export const initializeFirebaseAdmin = () => {
  try {
    const serviceAccountPath = process.env.FIREBASE_KEY_PATH || './service-account-key.json';
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error.message);
    throw new Error('Failed to initialize Firebase Admin SDK');
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
