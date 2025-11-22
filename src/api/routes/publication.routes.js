// src/api/routes/publication.routes.js
import express from 'express';
import { authenticateBackendJWT } from '#middlewares/auth.middleware.js';
import { createPublication, getAllPublications, getUserPublications, getPublicationById } from '#controllers/publication.controller.js';

const router = express.Router();

/**
 * @route POST /api/publications/new
 * @description Crea una nueva publicación (Trade) para el usuario autenticado.
 * @access Protegido (Backend JWT)
 */
router.post('/new', authenticateBackendJWT, createPublication);

/**
 * @route GET /api/publications/all
 * @description Obtiene todas las publicaciones activas (Trades) de la plataforma.
 * @access Protegido (Backend JWT)
 * IMPORTANTE: Esta ruta debe ir ANTES de /:id/show para evitar conflictos.
 */
router.get('/all', authenticateBackendJWT, getAllPublications);

router.get('/all/completed',);
router.get('/all/cancelled',);
router.get('/all/pending',);

/**
 * @route GET /api/publications/:id/show
 * @description Obtiene todas las publicaciones (creadas) de un usuario específico.
 * @access Protegido (Backend JWT)
 */
router.get('/:id/show', authenticateBackendJWT, getUserPublications);

router.get('/:id/completed',);
router.get('/:id/cancelled',);
router.get('/:id/pending',);

/**
 * @route GET /api/publications/:id
 * @description Obtiene una publicación específica por su ID.
 * @access Protegido (Backend JWT)
 */
router.get('/:id', authenticateBackendJWT, getPublicationById);

export default router;
