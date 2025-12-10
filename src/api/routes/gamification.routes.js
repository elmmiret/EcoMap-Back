import { Router } from 'express';
import { authenticateBackendJWT, requireAdminOrInstitution } from '#middlewares/auth.middleware.js';
import * as gamificationController from '../controllers/gamification.controller.js';

const router = Router();

// Rutas protegidas (Requieren Login)
router.use(authenticateBackendJWT);

// GET /api/gamification/me -> Ver mis puntos e historial
router.get('/me', gamificationController.getMyGamificationProfile);

// POST /api/gamification/grant -> Otorgar puntos (Solo Admin o Institución)
router.post('/grant', 
  requireAdminOrInstitution, 
  gamificationController.grantPoints
);

export default router;