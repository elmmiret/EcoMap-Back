import express from 'express';
import { authenticateBackendJWT } from '#middlewares/auth.middleware.js';
import {
  createReservation,
  getAllReservations,
  getReservationById,
  getReservationsByUserId,
  getReservationByUserIdAndId,
  deleteReservation,
  confirmReservation,
  getAllEndedReservations,
  getEndedReservationsByUserId,
  getReservationValorations,
  createValoration,
  getReservationsByTrade
} from '#controllers/reservation.controller.js';

const router = express.Router();

/**
 * @route POST /api/reservations/create
 * @description Crea una nueva reserva para un 'trade'.
 * @access Protegido (Cualquier usuario logueado, el controlador valida si es cliente)
 */
router.post('/create', authenticateBackendJWT, createReservation);

/**
 * @route PATCH /api/reservations/:reservationId
 * @description Confirma una reserva (pasando confirmed: true) y crea reservation_ended.
 * Solo para el dueño del Trade.
 */
router.patch('/:reservationId', authenticateBackendJWT, confirmReservation);

/**
 * @route DELETE /api/reservations/:reservationId/delete
 * @description Cancela una reserva por su ID.
 */
router.delete('/:reservationId/cancel', authenticateBackendJWT, deleteReservation);

/**
 * @route GET /api/reservations/trade/:publicationId
 * @description Obtiene todas las reservas hechas a un Trade específico.
 * Solo accesible por el dueño del Trade.
 */
router.get('/trade/:publicationId', authenticateBackendJWT, getReservationsByTrade);

/**
 * @route GET /api/reservations/ended
 * @description Obtiene TODAS las reservas finalizadas.
 */
router.get('/ended', authenticateBackendJWT, getAllEndedReservations);

/**
 * @route GET /api/reservations/ended/user/:userId
 * @description Obtiene las reservas finalizadas de un usuario específico.
 */
router.get('/ended/user/:userId', authenticateBackendJWT, getEndedReservationsByUserId);

/**
 * @route POST /api/reservations/ended/:reservationId/valorations
 * @description Crea una valoración para una reserva finalizada.
 */
router.post('/ended/:reservationId/valorations', authenticateBackendJWT, createValoration);

/**
 * @route GET /api/reservations/ended/:reservationId/valorations
 * @description Obtiene las valoraciones de una reserva finalizada específica.
 */
router.get('/ended/:reservationId/valorations', authenticateBackendJWT, getReservationValorations);

/**
 * @route GET /api/reservations
 * @description Obtiene todas las reservas.
 */
router.get('/', authenticateBackendJWT, getAllReservations);

/**
 * @route GET /api/reservations/user/:userId
 * @description Obtiene todas las reservas de un usuario.
 */
router.get('/user/:userId', authenticateBackendJWT, getReservationsByUserId);

/**
 * @route GET /api/reservations/user/:userId/:reservationId
 * @description Obtiene una reserva concreta de un usuario concreto.
 */
router.get('/user/:userId/:reservationId', authenticateBackendJWT, getReservationByUserIdAndId);

/**
 * @route GET /api/reservations/:reservationId
 * @description Obtiene el detalle de cualquier reserva por su ID.
 */
router.get('/:reservationId', authenticateBackendJWT, getReservationById);

export default router;
