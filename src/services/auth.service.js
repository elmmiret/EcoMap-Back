import { getFirebaseAuth } from '#config/firebase.js';
import { createLogger } from '#lib/logger.js';

const log = createLogger('auth');

/**
 * Verifies Firebase ID token and returns decoded token with user info
 * @param {string} idToken - Firebase ID token from client
 * @returns {Promise<Object>} Decoded token with uid, email, etc.
 * @throws {Error} If token is invalid or expired
 */
export const verifyIdToken = async (idToken) => {
  try {
    const auth = getFirebaseAuth();
    const decodedToken = await auth.verifyIdToken(idToken);

    log.debug(`Token verified for user: ${decodedToken.uid}`);

    return decodedToken;
  } catch (error) {
    log.warn('Token verification failed:', error.message);

    // Provide more specific error messages
    if (error.code === 'auth/id-token-expired') {
      throw new Error('Token has expired');
    } else if (error.code === 'auth/id-token-revoked') {
      throw new Error('Token has been revoked');
    } else if (error.code === 'auth/argument-error') {
      throw new Error('Invalid token format');
    }

    throw new Error('Invalid token');
  }
};

/**
 * Gets user data from Firebase by UID
 * @param {string} uid - Firebase user UID
 * @returns {Promise<Object>} User record from Firebase
 */
export const getUserByUid = async (uid) => {
  try {
    const auth = getFirebaseAuth();
    const userRecord = await auth.getUser(uid);
    return userRecord;
  } catch (error) {
    log.warn('Error fetching user ${uid}:', error.message);
    throw new Error('User not found');
  }
};

/**
 * Sets custom claims for a user (for role-based access control)
 * @param {string} uid - Firebase user UID
 * @param {Object} customClaims - Custom claims object (e.g., { role: 'admin' })
 */
export const setCustomClaims = async (uid, customClaims) => {
  try {
    const auth = getFirebaseAuth();
    await auth.setCustomUserClaims(uid, customClaims);
    log.info(`✅ Custom claims set for user ${uid}:`, customClaims);
  } catch (error) {
    log.error(`❌ Error setting custom claims for ${uid}:`, error.message);
    throw new Error('Failed to set custom claims');
  }
};

/**
 * Revokes all refresh tokens for a user (force logout)
 * @param {string} uid - Firebase user UID
 */
export const revokeRefreshTokens = async (uid) => {
  try {
    const auth = getFirebaseAuth();
    await auth.revokeRefreshTokens(uid);
    log.info(`✅ Refresh tokens revoked for user ${uid}`);
  } catch (error) {
    log.error(`❌ Error revoking tokens for ${uid}:`, error.message);
    throw new Error('Failed to revoke tokens');
  }
};

export const getAuth = () => {
  return getFirebaseAuth();
};
