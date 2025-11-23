// src/api/routes/publication.routes.js
import express from 'express';
import { authenticateBackendJWT } from '#middlewares/auth.middleware.js';
import {
  createTrade,
  createReward,
  deletePublication,  // detecta el tipo de publicación (Trade o Reward)
  getAllTrades,
  getUserTrades,
  getTradeById,
  getAllCompletedTrades,
  getAllCancelledTrades,
  getAllPendingTrades,
  getUserCompletedTrades,
  getUserCancelledTrades,
  getUserPendingTrades,
  updateTradeState,
} from '#controllers/publication.controller.js';

const router = express.Router();

/**
 * @route POST /api/publications/trades/new
 * @description Crea una nueva publicación (Trade) para el usuario autenticado de tipo client.
 * @access Protegido (Backend JWT)
 */
router.post('/trades/new', authenticateBackendJWT, createTrade);

/**
 * @route POST /api/publications/rewards/new
 * @description Crea una nueva publicación (Reward) para el usuario autenticado de tipo institution.
 * @access Protegido (Backend JWT)
 */
router.post('/rewards/new', authenticateBackendJWT, createReward);

/**
 * @route DELETE /api/publications/:id
 * @description Elimina una publicación. Valida permisos según si es Trade o Reward.
 * @access Protegido (Backend JWT - Solo el creador o admin)
 */
router.delete('/:id', authenticateBackendJWT, deletePublication);

/**
 * @route GET /api/publications/trades/all
 * @description Obtiene todas las publicaciones activas (Trades) de la plataforma.
 * @access Protegido (Backend JWT)
 * IMPORTANTE: Esta ruta debe ir ANTES de /:id/show para evitar conflictos.
 */
router.get('/trades/all', authenticateBackendJWT, getAllTrades);

// ----------------------- Rutas para filtrar publicaciones por estado -----------------------

/**
 * @route GET /api/publications/all/trades/completed
 * @description Obtiene todas las publicaciones con estado 'Completed'.
 * @access Protegido (Backend JWT)
 */
router.get('/trades/all/completed', authenticateBackendJWT, getAllCompletedTrades);

/**
 * @route GET /api/publications/all/cancelled
 * @description Obtiene todas las publicaciones con estado 'Cancelled'.
 * @access Protegido (Backend JWT)
 */
router.get('/trades/all/cancelled', authenticateBackendJWT, getAllCancelledTrades);

/**
 * @route GET /api/publications/trades/all/pending
 * @description Obtiene todas las publicaciones con estado 'Pending'.
 * @access Protegido (Backend JWT)
 */
router.get('/trades/all/pending', authenticateBackendJWT, getAllPendingTrades);

/**
 * @route GET /api/publications/trades/:id/show
 * @description Obtiene todas las publicaciones (creadas) de un usuario específico.
 * @access Protegido (Backend JWT)
 */
router.get('/trades/:id/show', authenticateBackendJWT, getUserTrades);

// ----------------------- Rutas para filtrar publicaciones de un usuario por estado -----------------------

/**
 * @route GET /api/publications/trades/:id/completed
 * @description Obtiene las publicaciones completadas de un usuario específico.
 * @access Protegido (Backend JWT)
 */
router.get('/trades/:id/completed', authenticateBackendJWT, getUserCompletedTrades);

/**
 * @route GET /api/publications/trades/:id/cancelled
 * @description Obtiene las publicaciones canceladas de un usuario específico.
 * @access Protegido (Backend JWT)
 */
router.get('/trades/:id/cancelled', authenticateBackendJWT, getUserCancelledTrades);

/**
 * @route GET /api/publications/trades/:id/pending
 * @description Obtiene las publicaciones pendientes de un usuario específico.
 * @access Protegido (Backend JWT)
 */
router.get('/trades/:id/pending', authenticateBackendJWT, getUserPendingTrades);

/**
 * @route PATCH /api/publications/trades/:id/state
 * @description Actualiza el estado de una publicación (Completed, Cancelled, Pending).
 * @access Protegido (Backend JWT - Solo el creador)
 */
router.patch('/trades/:id/state', authenticateBackendJWT, updateTradeState);

/**
 * @route GET /api/publications/trades/:id
 * @description Obtiene una publicación específica por su ID.
 * @access Protegido (Backend JWT)
 */
router.get('/trades/:id', authenticateBackendJWT, getTradeById);

export default router;
