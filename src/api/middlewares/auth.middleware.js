import { verifyIdToken } from '../../services/auth.service.js';

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

    // Attach user info to request object
    req.user = decodedToken;

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
