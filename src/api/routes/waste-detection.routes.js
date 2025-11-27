/**
 * Waste Detection Routes
 *
 * POST /api/recycling - Detectar basura en imagen
 */

import { Router } from 'express';
import { detectWasteInImage, uploadImage, handleMulterError } from '#controllers/waste-detection.controller.js';
import { requireApiKey } from '#middlewares/auth.middleware.js';

const router = Router();

// POST /api/recycling
// Recibe imagen multipart/form-data con key "image"
router.post('/recycling', requireApiKey, uploadImage, handleMulterError, detectWasteInImage);

export default router;
