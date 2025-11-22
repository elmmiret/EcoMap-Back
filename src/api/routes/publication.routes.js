// src/api/routes/publication.routes.js
import express from 'express';
import { authenticateBackendJWT } from '#middlewares/auth.middleware.js';
import { createPublication, 
    getAllPublications, 
    getUserPublications, 
    getPublicationById,
    getAllCompletedPublications,
    getAllCancelledPublications,
    getAllPendingPublications,
    getUserCompletedPublications,
    getUserCancelledPublications,
    getUserPendingPublications
} from '#controllers/publication.controller.js';

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

// ----------------------- Rutas para filtrar publicaciones por estado -----------------------

/**
 * @route GET /api/publications/all/completed
 * @description Obtiene todas las publicaciones con estado 'Completed'.
 * @access Protegido (Backend JWT)
 */
router.get('/all/completed', authenticateBackendJWT, getAllCompletedPublications);

/**
 * @route GET /api/publications/all/cancelled
 * @description Obtiene todas las publicaciones con estado 'Cancelled'.
 * @access Protegido (Backend JWT)
 */
router.get('/all/cancelled', authenticateBackendJWT, getAllCancelledPublications);

/**
 * @route GET /api/publications/all/pending
 * @description Obtiene todas las publicaciones con estado 'Pending'.
 * @access Protegido (Backend JWT)
 */
router.get('/all/pending', authenticateBackendJWT, getAllPendingPublications);

/**
 * @route GET /api/publications/:id/show
 * @description Obtiene todas las publicaciones (creadas) de un usuario específico.
 * @access Protegido (Backend JWT)
 */
router.get('/:id/show', authenticateBackendJWT, getUserPublications);

// ----------------------- Rutas para filtrar publicaciones de un usuario por estado -----------------------

/**
 * @route GET /api/publications/:id/completed
 * @description Obtiene las publicaciones completadas de un usuario específico.
 * @access Protegido (Backend JWT)
 */
router.get('/:id/completed',  authenticateBackendJWT, getUserCompletedPublications);

/**
 * @route GET /api/publications/:id/cancelled
 * @description Obtiene las publicaciones canceladas de un usuario específico.
 * @access Protegido (Backend JWT)
 */
router.get('/:id/cancelled', authenticateBackendJWT, getUserCancelledPublications);

/**
 * @route GET /api/publications/:id/pending
 * @description Obtiene las publicaciones pendientes de un usuario específico.
 * @access Protegido (Backend JWT)
 */
router.get('/:id/pending', authenticateBackendJWT, getUserPendingPublications);

/**
 * @route GET /api/publications/:id
 * @description Obtiene una publicación específica por su ID.
 * @access Protegido (Backend JWT)
 */
router.get('/:id', authenticateBackendJWT, getPublicationById);

export default router;
