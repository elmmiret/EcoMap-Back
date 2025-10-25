import { verifyIdToken } from '../../services/auth.service.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware to verify Firebase authentication token
 * Attaches decoded user info to req.user
 *
 * Usage:
 * router.get('/protected', authenticateUser, yourController);
 */
export const authenticateUser = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided',
        code: 'NO_TOKEN',
      });
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify token
    const decodedToken = await verifyIdToken(idToken);

    // Attach user info and token to request object
    req.user = decodedToken;
    req.token = idToken;

    // Continue to next middleware/controller
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error.message);

    if (error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
      code: 'INVALID_TOKEN',
    });
  }
};

/**
 * Middleware to verify Backend JWT (issued by our API)
 * Attaches decoded user info (payload) to req.user and the raw token to req.token
 * Use this for endpoints protected by our own JWT (e.g., /api/users/logout)
 */
export const authenticateBackendJWT = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided',
        code: 'NO_TOKEN',
      });
    }

    const token = authHeader.split('Bearer ')[1];

    if (!JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'JWT configuration error',
        code: 'JWT_CONFIG_ERROR',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded; // payload contains uid, email, etc.
    req.token = token;

    next();
  } catch (error) {
    console.error('Backend JWT middleware error:', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
      code: 'INVALID_TOKEN',
    });
  }
};
