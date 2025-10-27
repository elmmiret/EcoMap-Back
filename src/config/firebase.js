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
    // Opción 1: Leer desde variable de entorno (más seguro, sin archivo en disco)
    const serviceAccountJson = process.env.FIREBASE_KEY_JSON;

    // Opción 2: Leer desde archivo (fallback para desarrollo local)
    const serviceAccountPath = process.env.FIREBASE_KEY_PATH;

    let serviceAccount;

    if (serviceAccountJson) {
      // Producción: usar JSON directo desde variable de entorno
      serviceAccount = JSON.parse(serviceAccountJson);
      console.log('Firebase credentials loaded from FIREBASE_KEY_JSON (secure mode)');
    } else if (serviceAccountPath) {
      // Desarrollo: usar archivo local
      serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      console.log('Firebase credentials loaded from file:', serviceAccountPath);
    } else {
      throw new Error('Neither FIREBASE_KEY_JSON nor FIREBASE_KEY_PATH is defined in environment variables.');
    }

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
