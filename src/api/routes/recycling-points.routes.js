import express from 'express';
import { getRecyclingPointsByRegion, getStatusByRegion, forceRefreshByRegion } from '#controllers/recycling-points.controller.js';
import { authenticateBackendJWT, requireAdmin } from '#middlewares/auth.middleware.js';

const router = express.Router();

/**
 * @route GET /api/recycling-points/:region
 * @description Obtiene los puntos de reciclaje de una región específica desde cache (SWR).
 * @access Público
 * @param {string} region - Región de la que obtener puntos (navarra | barcelona)
 */
router.get('/:region', getRecyclingPointsByRegion);

/**
 * @route GET /api/recycling-points/:region/status
 * @description Obtiene el estado del cache para una región específica.
 * @access Protegido (requiere admin)
 * @param {string} region - Región (navarra | barcelona)
 */
router.get('/:region/status', authenticateBackendJWT, requireAdmin, getStatusByRegion);

/**
 * @route POST /api/recycling-points/:region/refresh
 * @description Fuerza una sincronización inmediata del cache para una región.
 * @access Protegido (requiere admin)
 * @param {string} region - Región (navarra | barcelona)
 */
router.post('/:region/refresh', authenticateBackendJWT, requireAdmin, forceRefreshByRegion);

export default router;
