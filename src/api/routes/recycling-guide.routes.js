import { Router } from 'express';
import * as guideController from '../controllers/recycling-guide.controller.js';
// Importar middlewares de autenticación y autorización
import { authenticateBackendJWT, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// GET /api/recycling-guide/search?q=...
// Endpoint público para buscar en la guía de reciclaje
router.get('/search', guideController.search);

// GET /api/recycling-guide/all
// Endpoint público para obtener todos los productos del catálogo
router.get('/all', guideController.getAllItems);

// POST /api/recycling-guide
// Solo administradores pueden añadir productos a la guía
router.post('/', authenticateBackendJWT, requireAdmin, guideController.addItem);

export default router;