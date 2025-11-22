/**
 * Bike Detection Routes
 *
 * POST /api/bikes - Detectar bicicleta en imagen
 */

import { Router } from 'express';
import { detectBikeInImage, uploadImage, handleMulterError } from '#controllers/bike-detection.controller.js';

const router = Router();

// POST /api/bikes
// Recibe imagen multipart/form-data con key "image"
router.post('/bikes', uploadImage, handleMulterError, detectBikeInImage);

export default router;
