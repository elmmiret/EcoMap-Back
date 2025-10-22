import { Router } from 'express';
import { login } from '../controllers/auth.controller.js';

const router = Router();

/**
 * POST /auth/login
 * Request body: { idToken: string }
 * Verifies Firebase ID token and authenticates user
 */
router.post('/login', login);

export default router;
