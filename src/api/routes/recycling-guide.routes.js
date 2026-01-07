import { Router } from 'express';
import * as guideController from '../controllers/recycling-guide.controller.js';
// Importar middlewares de autenticación y autorización
import { authenticateBackendJWT, requireAdmin } from '../middlewares/auth.middleware.js';
import { uploadImageMiddleware } from '../middlewares/upload.middleware.js';

const router = Router();

// GET /api/recycling-guide/search?q=...
// Endpoint público para buscar en la guía de reciclaje
router.get('/search', guideController.search);

// GET /api/recycling-guide/all
// Endpoint público para obtener todos los productos del catálogo
router.get('/all', guideController.getAllItems);

// POST /api/recycling-guide
// Solo administradores pueden añadir productos a la guía
router.post('/', authenticateBackendJWT, requireAdmin, uploadImageMiddleware, guideController.addItem);

// PUT /api/recycling-guide/:id
// Solo administradores pueden actualizar productos de la guía
router.put('/:id', authenticateBackendJWT, requireAdmin, uploadImageMiddleware, guideController.updateItem);

// DELETE /api/recycling-guide/all
// Solo administradores pueden eliminar todos los productos (usar con precaución)
// IMPORTANTE: Esta ruta debe ir ANTES de /:id para evitar que "all" sea capturado como un ID
router.delete('/all', authenticateBackendJWT, requireAdmin, guideController.deleteAllItems);

// DELETE /api/recycling-guide/:id
// Solo administradores pueden eliminar un producto específico
router.delete('/:id', authenticateBackendJWT, requireAdmin, guideController.deleteItem);

export default router;
