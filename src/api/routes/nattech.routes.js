import express from 'express';
import { authenticateBackendJWT, requireAdmin } from '#middlewares/auth.middleware.js';
import { listEvents, getEvent, createEvent, updateEvent, deleteEvent } from '#controllers/nattech.controller.js';

const router = express.Router();

// ----------------- rutas públicas -----------------

// GET /api/external/events
router.get('/events', authenticateBackendJWT, listEvents);

// GET /api/external/events/:codi
router.get('/events/:codi', authenticateBackendJWT, getEvent);

// ----------------- rutas exclusivas para usuarios 'admin' -----------------

// POST /api/external/events
router.post('/events', authenticateBackendJWT, requireAdmin, createEvent);

// PUT /api/external/events/:codi
router.put('/events/:codi', authenticateBackendJWT, requireAdmin, updateEvent);

// DELETE /api/external/events/:codi
router.delete('/events/:codi', authenticateBackendJWT, requireAdmin, deleteEvent);

export default router;
