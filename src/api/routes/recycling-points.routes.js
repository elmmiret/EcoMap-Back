import express from 'express';
import { getNavarraRecyclingPoints, getNavarraRecyclingPointById } from '../../services/navarra.service.js';
import { getBarcelonaRecyclingPoints, getBarcelonaRecyclingPointById } from '../../services/barcelona.service.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    console.log('🔎 Solicitando puntos combinados...');

    const [navarraPoints, barcelonaPoints] = await Promise.all([
      getNavarraRecyclingPoints().catch((e) => {
        console.error('❌ Error al obtener puntos de Navarra:', e.message);
        return [];
      }),
      getBarcelonaRecyclingPoints().catch((e) => {
        console.error('❌ Error al obtener puntos de Barcelona:', e.message);
        return [];
      }),
    ]);

    const normalizedNavarra = navarraPoints.map((p) => ({
      ...p,
      location: 'Navarra',
    }));

    const normalizedBarcelona = barcelonaPoints.map((p) => ({
      ...p,
      location: 'Barcelona',
    }));

    const allPoints = [...normalizedNavarra, ...normalizedBarcelona];

    res.status(200).json({
      success: true,
      message: `Datos combinados (${allPoints.length} puntos totales)`,
      data: allPoints,
    });
  } catch (error) {
    console.error('❌ Error combinando los datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los puntos combinados',
      code: 'COMBINED_API_ERROR',
    });
  }
});

/**
 * GET /api/recycling-points/:region/:id
 * Ejemplo: /api/recycling-points/navarra/25  o  /api/recycling-points/barcelona/25
 */
router.get('/:region/:id', async (req, res) => {
  const { region, id } = req.params;

  try {
    let record = null;

    if (region.toLowerCase() === 'navarra') {
      record = await getNavarraRecyclingPointById(id);
      if (record) {
        return res.status(200).json({
          success: true,
          message: `Punto de reciclaje encontrado en Navarra`,
          data: { ...record, location: 'Navarra' },
        });
      }
    }

    if (region.toLowerCase() === 'barcelona') {
      record = await getBarcelonaRecyclingPointById(id);
      if (record) {
        return res.status(200).json({
          success: true,
          message: `Punto de reciclaje encontrado en Barcelona`,
          data: { ...record, location: 'Barcelona' },
        });
      }
    }

    return res.status(404).json({
      success: false,
      message: `No se ha encontrado ningún punto con id ${id} en ${region}`,
      code: 'RECYCLING_POINT_NOT_FOUND',
    });
  } catch (error) {
    console.error('❌ Error al obtener punto específico:', error);
    res.status(500).json({
      success: false,
      message: 'Error al consultar el punto de reciclaje',
      code: 'RECYCLING_POINT_ERROR',
    });
  }
});

export default router;
