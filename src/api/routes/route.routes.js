import express from 'express';
import { calculateRoute } from '#controllers/route.controller.js';

const router = express.Router();

/**
 * @route GET /api/routes
 * @description Calcula la ruta óptima entre dos puntos geográficos.
 * @access Público
 * @query {string} start - Coordenadas de inicio en formato "lat,lng" (ej: "41.3851,2.1734")
 * @query {string} end - Coordenadas de destino en formato "lat,lng" (ej: "41.3879,2.1699")
 * @query {string} [profile] - Perfil de ruta: driving-car (default), walking, cycling, etc.
 */
router.get('/', calculateRoute);

export default router;
