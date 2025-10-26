#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

// Restrict execution in production environments
const NODE_ENV = process.env.NODE_ENV || 'development';
if (NODE_ENV === 'production') {
  console.error('❌ This utility is disabled in production (NODE_ENV=production).');
  process.exit(1);
}

import { getFirebaseAuth } from '#config/firebase.js';

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

  // If the environment provides a Firebase Web API Key, exchange the
  // custom token for a real ID token using the Identity Toolkit REST API.
  // Exchange the custom token for an ID token using the Identity Toolkit
  // REST endpoint. The script will only print the `idToken` to stdout so it
  // can be piped/copied directly into an Authorization header.
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) {
    console.error('FIREBASE_WEB_API_KEY is required to obtain an ID token. Set it in your environment.');
    process.exit(1);
  }

  // Ensure `fetch` is available (Node 18+). If not, try to dynamically import
  // `node-fetch` (only for convenience in local dev). If that fails, abort.
  let fetchFn = global.fetch;
  if (!fetchFn) {
    try {
      // node-fetch v3 is ESM default export
      const nodeFetch = await import('node-fetch');
      fetchFn = nodeFetch.default || nodeFetch;
    } catch {
      console.error('`fetch` is not available and `node-fetch` could not be imported. Run with Node 18+ or install node-fetch.');
      process.exit(1);
    }
  }

  try {
    const resp = await fetchFn(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    });

    const data = await resp.json();
    if (!resp.ok || !data.idToken) {
      console.error('Failed to exchange custom token for ID token:', data);
      process.exit(1);
    }

    // Print only the idToken to stdout (no extra text). This is what should be
    // passed as `Authorization: Bearer <TOKEN>` in Postman or curl.
    console.log(data.idToken);
    process.exit(0);
  } catch (ex) {
    console.error('Error while exchanging custom token for ID token:', ex);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error generating Firebase token:', error.message);
  if (!process.env.FIREBASE_KEY_PATH) {
    console.error('Ensure FIREBASE_KEY_PATH is set and points to a valid service account JSON.');
  }
  process.exit(1);
}
