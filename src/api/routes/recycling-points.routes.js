import express from 'express';
import { getNavarraRecyclingPoints } from '../../services/navarra.service.js';
import { getBarcelonaRecyclingPoints } from '../../services/barcelona.service.js';

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

/*router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const navarraPoint = await getNavarraRecyclingPointById(id);
    if (navarraPoint) {
      return res.status(200).json({
        success: true,
        message: `Punto de reciclaje encontrado en Navarra`,
        data: { ...navarraPoint, location: 'Navarra' },
      });
    }

    const barcelonaPoint = await getBarcelonaRecyclingPointById(id);
    if (barcelonaPoint) {
      return res.status(200).json({
        success: true,
        message: `Punto de reciclaje encontrado en Barcelona`,
        data: { ...barcelonaPoint, location: 'Barcelona' },
      });
    }

    res.status(404).json({
      success: false,
      message: `No se ha encontrado ningún punto con id ${id}`,
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
});*/

export default router;
