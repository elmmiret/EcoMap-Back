import express from 'express';
import { authenticateBackendJWT, requireAdmin, requireInstitution } from '#middlewares/auth.middleware.js';
import { listEvents, getEvent, createEvent, updateEvent, deleteEvent } from '#controllers/nattech.controller.js';

const router = express.Router();

// ----------------- rutas públicas (autenticadas pero cualquier rol) -----------------

// GET /api/external/events (filtrado forzoso por tag EcoMap)
router.get('/events', authenticateBackendJWT, listEvents);

// GET /api/external/events/:codi (solo si tiene tag EcoMap)
router.get('/events/:codi', authenticateBackendJWT, getEvent);

// ----------------- rutas exclusivas para usuarios 'institution' -----------------

// POST /api/external/events (tag EcoMap forzado)
router.post('/events', authenticateBackendJWT, requireInstitution || requireAdmin, createEvent);

// PUT /api/external/events/:codi (tags inmutables)
router.put('/events/:codi', authenticateBackendJWT, requireInstitution || requireAdmin, updateEvent);

// DELETE /api/external/events/:codi (verifica tag EcoMap antes de borrar)
router.delete('/events/:codi', authenticateBackendJWT, requireInstitution || requireAdmin, deleteEvent);

export default router;
