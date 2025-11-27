import express from 'express';
import { authenticateBackendJWT } from '#middlewares/auth.middleware.js';
import { 
    createReservation, 
    getAllReservations,
    getReservationById,
    getReservationsByUserId,
    getReservationByUserIdAndId,
    cancelReservation,
} from '#controllers/reservation.controller.js';

const router = express.Router();

/**
 * @route POST /api/reservations/create
 * @description Crea una nueva reserva para un 'trade'.
 * @access Protegido (Cualquier usuario logueado, el controlador valida si es cliente)
 */
router.post('/create', authenticateBackendJWT, createReservation);

/**
 * @route DELETE /api/reservations/:reservationId/cancel
 * @description Cancela una reserva por su ID.
 */
router.delete('/:reservationId/cancel', authenticateBackendJWT, cancelReservation);

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
 * IMPORTANTE: Esta ruta debe ir AL FINAL para no capturar "/user/..." como si fuera un ID.
 */
router.get('/:reservationId', authenticateBackendJWT, getReservationById);

export default router;