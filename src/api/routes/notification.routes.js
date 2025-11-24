import { Router } from 'express';
import { saveToken } from '../controllers/notification.controller.js';
import { authenticateBackendJWT } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateBackendJWT);

/**
 * @route POST /api/notifications/token
 * @desc Register a device token for push notifications
 * @access Private
 */
router.post('/token', saveToken);

export default router;
