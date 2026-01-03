import express from 'express';
import { authenticateBackendJWT, requireAdmin } from '#middlewares/auth.middleware.js';
import { listEvents, getEvent, createEvent, updateEvent, deleteEvent } from '#controllers/nattech.controller.js';

const router = express.Router();

// rutas públicas
router.get('/events', authenticateBackendJWT, listEvents);
router.get('/events/:codi', authenticateBackendJWT, getEvent);

// rutas exclusivas para usuarios 'admin'
router.post('/events', authenticateBackendJWT, requireAdmin, createEvent);
router.put('/events/:codi', authenticateBackendJWT, requireAdmin, updateEvent);
router.delete('/events/:codi', authenticateBackendJWT, requireAdmin, deleteEvent);

export default router;
