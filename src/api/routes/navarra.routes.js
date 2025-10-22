import express from 'express';
import { importNavarraRecyclingPoints } from '../../services/navarra.service.js';

const router = express.Router();

router.post('/refresh', async (_req, res) => {
  await importNavarraRecyclingPoints();
  res.json({ message: 'Dades de reciclatge de Navarra actualitzades manualment' });
});

export default router;
