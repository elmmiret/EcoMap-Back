import express from 'express';
import admin from 'firebase-admin';
import authRoutes from './api/routes/user.routes.js';
import navarraRoutes from './api/routes/navarra.routes.js';
import barcelonaRoutes from './api/routes/barcelona.routes.js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

// cargar variables de entorno desde .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- CORS Configuration ---
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // En producción, especifica el dominio exacto
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Maneja preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// middleware global
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- INICIALIZACION de Firebase Admin SDK ---
const keyPath = process.env.FIREBASE_KEY_PATH;

if (!keyPath) {
  console.error('FATAL ERROR: FIREBASE_KEY_PATH no se encuentra definido en las variables de entorno');
  process.exit(1);
}

try {
  // importar archivo json de la clave de servicio usando la ruta de entorno
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log(`Firebase Admin SDK inicializado correctamente usando la llave de: ${keyPath}`);
} catch (e) {
  console.error(`FATAL ERROR: No se ha podido cargar la llave de Firebase Service Account de: ${keyPath}`);
  console.error('Detalles:', process.env.NODE_ENV === 'development' ? e.message : 'Error al cargar la clave.');
  process.exit(1);
}

// montar las rutas de autentificación bajo el prefijo /api/users
app.use('/api/users', authRoutes);
app.use('/api/navarra', navarraRoutes);
app.use('/api/barcelona', barcelonaRoutes);

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
