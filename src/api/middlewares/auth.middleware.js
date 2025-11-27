import { verifyIdToken } from '#services/auth.service.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { prisma } from '#lib/prisma.js';
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
export const authenticateBackendJWT = async (req, res, next) => {
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

    // Verificar que la sesión existe en la base de datos
    const session = await prisma.session.findUnique({
      where: { jwt: token },
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session is not valid',
        code: 'INVALID_SESSION',
      });
    }

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

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token signature',
        code: 'INVALID_TOKEN',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error during token authentication',
      code: 'AUTH_SERVER_ERROR',
    });
  }
};

/**
 * Middleware to verify that the authenticated user is an admin
 * MUST be used after authenticateBackendJWT middleware
 * Checks req.user.role from the decoded JWT payload
 *
 * Usage:
 * router.post('/admin-only', authenticateBackendJWT, requireAdmin, controller);
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'NOT_AUTHENTICATED',
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin privileges required',
      code: 'FORBIDDEN',
    });
  }

  // Usuario es admin, continuar
  next();
};

/**
 * Middleware to verify that the authenticated user is an institution
 * MUST be used after authenticateBackendJWT middleware
 * Checks req.user.role from the decoded JWT payload
 *
 * Usage:
 * router.post('/institution-only', authenticateBackendJWT, requireInstitution, controller);
 */
export const requireInstitution = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'NOT_AUTHENTICATED',
    });
  }

  if (req.user.role !== 'institution') {
    return res.status(403).json({
      success: false,
      message: 'Institution privileges required',
      code: 'FORBIDDEN',
    });
  }

  // Usuario es institution, continuar
  next();
};

/**
 * Middleware to verify that the authenticated user is either admin or institution
 * MUST be used after authenticateBackendJWT middleware
 * Useful for endpoints that should be accessible by both roles
 *
 * Usage:
 * router.get('/stats', authenticateBackendJWT, requireAdminOrInstitution, controller);
 */
export const requireAdminOrInstitution = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'NOT_AUTHENTICATED',
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'institution') {
    return res.status(403).json({
      success: false,
      message: 'Admin or institution privileges required',
      code: 'FORBIDDEN',
    });
  }

  // Usuario tiene permisos, continuar
  next();
};

/**
 * Middleware to verify that the authenticated user is a client
 * MUST be used after authenticateBackendJWT middleware
 * Checks req.user.role from the decoded JWT payload
 *
 * Usage:
 * router.post('/client-only', authenticateBackendJWT, requireClient, controller);
 */
export const requireClient = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'NOT_AUTHENTICATED',
    });
  }

  if (req.user.role !== 'client') {
    return res.status(403).json({
      success: false,
      message: 'Client privileges required',
      code: 'FORBIDDEN',
    });
  }

  // Usuario es client, continuar
  next();
};

/**
 * Middleware to verify API Key for external services
 * Checks x-api-key header
 */
export const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.AI_SERVICE_API_KEY;

  if (!validApiKey) {
    console.error('AI_SERVICE_API_KEY not configured in environment variables');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error',
      code: 'CONFIG_ERROR',
    });
  }

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or missing API Key',
      code: 'INVALID_API_KEY',
    });
  }

  next();
};
