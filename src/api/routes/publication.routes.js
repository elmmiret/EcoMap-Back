import express from 'express';
import { authenticateBackendJWT } from '#middlewares/auth.middleware.js';
import { uploadImageMiddleware } from '#middlewares/upload.middleware.js';
import {
  createTrade,
  createReward,
  updateRewardAvailability,
  getAllRewards,
  getInstitutionRewards,
  deletePublication,
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
  updateTradeBody,
  getTradeOwnerScore,
} from '#controllers/publication.controller.js';

const router = express.Router();

// ==========================================
//                 REWARDS
// ==========================================

/**
 * @route POST /api/publications/rewards
 * @description Crea una nueva publicación (Reward) - Solo Instituciones.
 */
router.post('/rewards', authenticateBackendJWT, uploadImageMiddleware, createReward);

/**
 * @route GET /api/publications/rewards
 * @description Obtiene todas las publicaciones de tipo reward.
 */
router.get('/rewards', authenticateBackendJWT, getAllRewards);

/**
 * @route GET /api/publications/rewards/institution/:institutionId
 * @description Obtiene todos los rewards de una institución específica.
 * CAMBIO: Añadido prefix '/institution' para no confundir con ID de publicación.
 */
router.get('/rewards/institution/:institutionId', authenticateBackendJWT, getInstitutionRewards);

/**
 * @route PATCH /api/publications/rewards/:id/availability
 * @description Actualiza la disponibilidad de un reward.
 */
router.patch('/rewards/:id/availability', authenticateBackendJWT, updateRewardAvailability);

// ==========================================
//                  TRADES
// ==========================================

/**
 * @route POST /api/publications/trades
 * @description Crea una nueva publicación (Trade) - Solo Clientes.
 */
router.post('/trades', authenticateBackendJWT, uploadImageMiddleware, createTrade);

/**
 * @route GET /api/publications/trades
 * @description Obtiene todas las publicaciones activas (Trades).
 */
router.get('/trades', authenticateBackendJWT, getAllTrades);

// --- Filtros Globales por Estado ---

/**
 * @route GET /api/publications/trades/status/completed
 * @description Obtiene todos los trades con estado 'Completed'.
 * CAMBIO: Agrupado bajo '/status' para claridad.
 */
router.get('/trades/status/completed', authenticateBackendJWT, getAllCompletedTrades);

/**
 * @route GET /api/publications/trades/status/cancelled
 * @description Obtiene todos los trades con estado 'Cancelled'.
 */
router.get('/trades/status/cancelled', authenticateBackendJWT, getAllCancelledTrades);

/**
 * @route GET /api/publications/trades/status/pending
 * @description Obtiene todos los trades con estado 'Pending'.
 */
router.get('/trades/status/pending', authenticateBackendJWT, getAllPendingTrades);

// --- Filtros por Usuario (User Trades) ---

/**
 * @route GET /api/publications/trades/user/:userId
 * @description Obtiene todos los trades de un usuario específico.
 * CAMBIO: '/user/:userId' elimina la ambigüedad de si es ID de trade o de usuario.
 */
router.get('/trades/user/:userId', authenticateBackendJWT, getUserTrades);

/**
 * @route GET /api/publications/trades/user/:userId/completed
 * @description Obtiene trades completados de un usuario.
 */
router.get('/trades/user/:userId/completed', authenticateBackendJWT, getUserCompletedTrades);

/**
 * @route GET /api/publications/trades/user/:userId/cancelled
 * @description Obtiene trades cancelados de un usuario.
 */
router.get('/trades/user/:userId/cancelled', authenticateBackendJWT, getUserCancelledTrades);

/**
 * @route GET /api/publications/trades/user/:userId/pending
 * @description Obtiene trades pendientes de un usuario.
 */
router.get('/trades/user/:userId/pending', authenticateBackendJWT, getUserPendingTrades);

// --- Gestión Individual de Trades ---

/**
 * @route PATCH /api/publications/trades/:id/state
 * @description Actualiza el estado de un Trade.
 */
router.patch('/trades/:id/state', authenticateBackendJWT, updateTradeState);

/**
 * @route PATCH /api/publications/trades/:id/body
 * @description Actualiza el contenido (título, descripción, imagen) de un Trade.
 * @access Protegido (Solo creador)
 */
router.patch('/trades/:id/body', authenticateBackendJWT, uploadImageMiddleware, updateTradeBody);

/**
 * @route GET /api/publications/trades/:id/score
 * @description Obtiene el valorations_score del dueño del Trade.
 */
router.get('/trades/:id/score', authenticateBackendJWT, getTradeOwnerScore);

/**
 * @route GET /api/publications/trades/:id
 * @description Obtiene el detalle de un Trade por su ID.
 */
router.get('/trades/:id', authenticateBackendJWT, getTradeById);

// ==========================================
//                 GENÉRICOS
// ==========================================

/**
 * @route DELETE /api/publications/:id
 * @description Elimina una publicación (Trade o Reward).
 */
router.delete('/:id', authenticateBackendJWT, deletePublication);

export default router;
