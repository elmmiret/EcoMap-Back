import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initializeFirebaseAdmin } from '#config/firebase.js';
import { startSchedulers } from '#services/scheduler.service.js';
import { warmupCaches } from '#services/scheduler.service.js';
import { initializeSocket } from '#services/socket.service.js';
import { createLogger } from '#lib/logger.js';

import authRoutes from './api/routes/user.routes.js';
import recyclingPoints from './api/routes/recycling-points.routes.js';
import routeRoutes from './api/routes/route.routes.js';
import bikeDetectionRoutes from './api/routes/bike-detection.routes.js';
import wasteDetectionRoutes from './api/routes/waste-detection.routes.js';
import publicationRoutes from './api/routes/publication.routes.js';
import reservationRoutes from './api/routes/reservation.routes.js';
import chatRoutes from './api/routes/chat.routes.js';
import notificationRoutes from './api/routes/notification.routes.js';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// cargar variables de entorno desde .env
dotenv.config();

const log = createLogger('startup');

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Configuración de Swagger según el entorno
const isProduction = process.env.NODE_ENV === 'production';
const swaggerDoc = isProduction ? yaml.load(path.join(__dirname, '../swagger-public.yaml')) : yaml.load(path.join(__dirname, '../swagger.yaml'));

const swaggerTitle = isProduction ? 'PESkaos AI Detection API - Public' : 'PESkaos API - Complete Documentation (Development)';

// --- INICIALIZACION de Firebase Admin SDK ---
initializeFirebaseAdmin();

// middleware global
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ruta para la documentación de la API
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDoc, {
    customSiteTitle: swaggerTitle,
  })
);

// montar las rutas de autentificación bajo el prefijo /api/users
app.use('/api/users', authRoutes);
app.use('/api/recycling-points', recyclingPoints);
app.use('/api/routes', routeRoutes);
app.use('/api', bikeDetectionRoutes);
app.use('/api', wasteDetectionRoutes);
app.use('/api/publications', publicationRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/notifications', notificationRoutes);

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
httpServer.listen(PORT, () => {
  log.info(`Servidor Express corriendo en http://localhost:${PORT}`);

  // Initialize Socket.io
  initializeSocket(httpServer);
  log.info('Socket.io initialized');

  // Start background schedulers only in production (avoid cron traffic in development)
  if (process.env.NODE_ENV === 'production') {
    startSchedulers();
  } else {
    log.info(`Skipping schedulers (NODE_ENV=${process.env.NODE_ENV || 'undefined'})`);
  }

  // Trigger an immediate warmup (refresh) only in production
  if (process.env.NODE_ENV === 'production') {
    // Run without awaiting to avoid delaying server readiness.
    warmupCaches().catch((e) => log.error('Warmup failed:', e?.message || e));
  } else {
    log.info(`Skipping warmup (NODE_ENV=${process.env.NODE_ENV || 'undefined'})`);
  }
});
