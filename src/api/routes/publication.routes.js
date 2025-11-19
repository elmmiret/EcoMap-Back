// src/api/routes/publication.routes.js
import express from 'express';
import { authenticateBackendJWT } from '#middlewares/auth.middleware.js';
import { createPublication, getUserPublications } from '#controllers/publication.controller.js';

const router = express.Router();

/**
 * @route POST /api/publications/new
 * @description Crea una nueva publicación (Trade) para el usuario autenticado.
 * @access Protegido (Backend JWT)
 */
router.post('/new', authenticateBackendJWT, createPublication);

/**
 * @route GET /api/publications/:id/show
 * @description Obtiene todas las publicaciones (creadas) de un usuario específico.
 * @access Protegido (Backend JWT)
 */
router.get('/:id/show', authenticateBackendJWT, getUserPublications);

export default router;