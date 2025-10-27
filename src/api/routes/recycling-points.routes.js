import express from 'express';
import { getRecyclingPointsByRegion } from '#controllers/recycling-points.controller.js';

const router = express.Router();

/**
 * @route GET /api/recycling-points/:region
 * @description Obtiene los puntos de reciclaje de una región específica (navarra o barcelona).
 * @access Público
 * @param {string} region - Región de la que obtener puntos (navarra | barcelona)
 * @query {object} queryParams - Parámetros opcionales de filtrado (q, filters, etc.)
 */
router.get('/:region', getRecyclingPointsByRegion);

export default router;
