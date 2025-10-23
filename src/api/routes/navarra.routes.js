import express from 'express';
import { getNavarraRecyclingPoints } from '../../services/navarra.service.js';

const router = express.Router();

router.get('/points', async (req, res) => {
  try {
    const records = await getNavarraRecyclingPoints();
    res.json(records);
  } catch (err) {
    console.error('Error obtenint punts de reciclatge:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
