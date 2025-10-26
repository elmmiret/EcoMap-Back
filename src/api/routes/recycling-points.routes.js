import express from 'express';
import { getNavarraRecyclingPoints } from '#services/navarra.service.js';
import { getBarcelonaRecyclingPoints } from '#services/barcelona.service.js';

const router = express.Router();

router.get('/:region', async (req, res) => {
  const startTime = Date.now();
  const requestId = `${req.params.region}-${Date.now()}`;
  
  console.log(`[START][${requestId}] Request iniciado:`, {
    timestamp: new Date().toISOString(),
    region: req.params.region,
    query: req.query,
  });

  try {
    const { region } = req.params;
    const queryParams = req.query;

    if (region === 'navarra') {
      console.log(`[BEFORE FETCH][${requestId}] Llamando a API de Navarra:`, {
        timestamp: new Date().toISOString(),
        elapsed: `${Date.now() - startTime}ms`,
      });

      const navarraPoints = await getNavarraRecyclingPoints(queryParams);

      console.log(`[AFTER FETCH][${requestId}] Respuesta recibida de Navarra:`, {
        timestamp: new Date().toISOString(),
        elapsed: `${Date.now() - startTime}ms`,
        recordsCount: navarraPoints.length,
      });

      console.log(`[END][${requestId}] Enviando respuesta al cliente:`, {
        timestamp: new Date().toISOString(),
        elapsed: `${Date.now() - startTime}ms`,
        statusCode: 200,
      });

      return res.status(200).json({
        success: true,
        message: 'Puntos de reciclaje encontrados en Navarra',
        data: navarraPoints,
      });
    }

    if (region === 'barcelona') {
      console.log(`[BEFORE FETCH][${requestId}] Llamando a API de Barcelona:`, {
        timestamp: new Date().toISOString(),
        elapsed: `${Date.now() - startTime}ms`,
      });

      const barcelonaPoints = await getBarcelonaRecyclingPoints(queryParams);

      console.log(`[AFTER FETCH][${requestId}] Respuesta recibida de Barcelona:`, {
        timestamp: new Date().toISOString(),
        elapsed: `${Date.now() - startTime}ms`,
        recordsCount: barcelonaPoints.length,
      });

      console.log(`[END][${requestId}] Enviando respuesta al cliente:`, {
        timestamp: new Date().toISOString(),
        elapsed: `${Date.now() - startTime}ms`,
        statusCode: 200,
      });

      return res.status(200).json({
        success: true,
        message: 'Puntos de reciclaje encontrados en Barcelona',
        data: barcelonaPoints,
      });
    }

    console.log(`[END][${requestId}] Región no encontrada:`, {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - startTime}ms`,
      statusCode: 404,
      region,
    });

    return res.status(404).json({
      success: false,
      message: `Región no encontrada: ${region}`,
      code: 'REGION_NOT_FOUND',
    });
  } catch (error) {
    console.error(`[ERROR][${requestId}] Error al obtener puntos:`, {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - startTime}ms`,
      errorCode: error.code,
      errorMessage: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: 'Error al consultar los puntos de reciclaje',
      code: 'RECYCLING_POINTS_ERROR',
    });
  }
});

export default router;
