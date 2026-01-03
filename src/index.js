import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initializeFirebaseAdmin } from '#config/firebase.js';
import { startSchedulers } from '#services/scheduler.service.js';
import { warmupCaches } from '#services/scheduler.service.js';
import { initializeSocket } from '#services/socket.service.js';
import { startMessageQueue, recoverPendingMessages } from '#services/message-queue.service.js';
import { createLogger } from '#lib/logger.js';

import authRoutes from './api/routes/user.routes.js';
import recyclingPoints from './api/routes/recycling-points.routes.js';
import routeRoutes from './api/routes/route.routes.js';
import bikeDetectionRoutes from './api/routes/bike-detection.routes.js';
import wasteDetectionRoutes from './api/routes/waste-detection.routes.js';
import publicationRoutes from './api/routes/publication.routes.js';
import reservationRoutes from './api/routes/reservation.routes.js';
import nattechRoutes from './api/routes/nattech.routes.js';
import chatRoutes from './api/routes/chat.routes.js';
import notificationRoutes from './api/routes/notification.routes.js';
import gamificationRoutes from './api/routes/gamification.routes.js';
import swaggerUi from 'swagger-ui-express';
import recyclingGuideRoutes from './api/routes/recycling-guide.routes.js';
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

// /api-docs-private siempre muestra la documentación completa (swagger.yaml) - requiere autenticación admin
let swaggerDoc;
try {
  const privatePath = path.join(__dirname, '../swagger.yaml');
  swaggerDoc = yaml.load(privatePath);
} catch (err) {
  log.error('Error loading swagger:', err.message);
  swaggerDoc = { info: { title: 'Error loading private docs' } };
}
// --- INICIALIZACION de Firebase Admin SDK ---
initializeFirebaseAdmin();

// middleware global
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir Swagger UI assets (CSS, JS, etc.)
app.use('/api-docs', swaggerUi.serve);

// Ruta para la documentación de la API pública
app.get('/api-docs', (req, res, next) => {
  return swaggerUi.setup(swaggerDoc, {
    customSiteTitle: 'PESkaos API - Public Documentation',
  })(req, res, next);
});

// montar las rutas de autentificación bajo el prefijo /api
app.use('/api/users', authRoutes);
app.use('/api/external', nattechRoutes);
app.use('/api/recycling-points', recyclingPoints);
app.use('/api/routes', routeRoutes);
app.use('/api', bikeDetectionRoutes);
app.use('/api', wasteDetectionRoutes);
app.use('/api/publications', publicationRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/recycling-guide', recyclingGuideRoutes);

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

  // Initialize message queue
  startMessageQueue();
  log.info('Message queue processor started');

  // Recover pending messages from database
  recoverPendingMessages().catch((e) => log.error('Failed to recover pending messages:', e?.message || e));

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
