#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

// Restrict execution in production environments
const NODE_ENV = process.env.NODE_ENV || 'development';
if (NODE_ENV === 'production') {
  console.error('❌ This utility is disabled in production (NODE_ENV=production).');
  process.exit(1);
}

import { getFirebaseAuth } from '../src/config/firebase.js';

const usage = () => {
  console.log('Usage: npm run token:firebase -- <uid>');
  console.log('Env required: FIREBASE_KEY_PATH');
};

const uid = process.argv[2];

if (!uid) {
  usage();
  process.exit(1);
}

try {
  const auth = getFirebaseAuth();

  // 1) Create a Custom Token for the given UID
  const customToken = await auth.createCustomToken(uid);

  console.log('✅ Firebase Custom Token generated successfully');
  console.log('Custom Token (use this on a client to exchange for an ID token):');
  console.log(customToken);
} catch (error) {
  console.error('❌ Error generating Firebase token:', error.message);
  if (!process.env.FIREBASE_KEY_PATH) {
    console.error('Ensure FIREBASE_KEY_PATH is set and points to a valid service account JSON.');
  }
  process.exit(1);
}
