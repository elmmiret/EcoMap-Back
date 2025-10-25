import express from 'express';
import { getBarcelonaRecyclingPoints } from '../../services/barcelona.service.js';

const router = express.Router();

router.get('/points', async (req, res) => {
  try {
    // Captura los parametros del query (ej: ?municipio=Pamplona)
    const filters = req.query;

    // Paasa los filtros a la función del servicio
    const records = await getBarcelonaRecyclingPoints(filters);
    res.json(records);
  } catch (err) {
    console.error('Error obtenint punts de reciclatge:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
