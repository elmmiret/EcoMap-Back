import express from 'express';
import { initializeFirebaseAdmin } from './config/firebase.js';
import authRoutes from './api/routes/user.routes.js';
import recyclingPoints from './api/routes/recycling-points.routes.js';
import dotenv from 'dotenv';

// cargar variables de entorno desde .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- INICIALIZACION de Firebase Admin SDK ---
initializeFirebaseAdmin();

// middleware global
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// montar las rutas de autentificación bajo el prefijo /api/users
app.use('/api/users', authRoutes);
app.use('/api/recycling-points', recyclingPoints);

// ruta base para verificar que la API está corriendo
app.get('/', (req, res) => {
  res.send('API running.');
});

// manejo de errores global
app.use((err, req, res, _next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor Express corriendo en http://localhost:${PORT}`);
});
