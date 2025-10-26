import express from 'express';
import { getRoute } from '../../services/route.service.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { start, end, profile } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: 'Debes especificar start y end (lat,lng)',
      });
    }

    const [startLat, startLng] = start.split(',').map(Number);
    const [endLat, endLng] = end.split(',').map(Number);

    const result = await getRoute({ lat: startLat, lng: startLng }, { lat: endLat, lng: endLng }, profile || 'driving-car');

    res.json({
      success: true,
      message: 'Ruta calculada correctamente',
      data: result,
    });
  } catch (error) {
    console.error('Error calculando ruta:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
