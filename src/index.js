import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { initializeFirebaseAdmin } from '#config/firebase.js';
import { startSchedulers } from '#services/scheduler.service.js';
import { warmupCaches } from '#services/scheduler.service.js';
import { initializeSocket } from '#services/socket.service.js';
import { startMessageQueue, recoverPendingMessages } from '#services/message-queue.service.js';
import { createLogger } from '#lib/logger.js';
import { authenticateBackendJWT, requireAdmin } from '#middlewares/auth.middleware.js';

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

const isDevelopment = process.env.NODE_ENV === 'development';

// En desarrollo, /api-docs muestra directamente el swagger privado sin autenticación
let publicSwaggerDoc;
let privateSwaggerDoc;

if (isDevelopment) {
  // En desarrollo: cargar solo el privado para /api-docs
  try {
    const privatePath = path.join(__dirname, '../swagger.yaml');
    publicSwaggerDoc = yaml.load(privatePath); // Usar privado en /api-docs
  } catch (err) {
    log.error('Error loading swagger:', err.message);
    publicSwaggerDoc = { info: { title: 'Error loading docs' } };
  }
} else {
  // En otros entornos: cargar público y privado separados
  try {
    const publicPath = path.join(__dirname, '../swagger-public.yaml');
    publicSwaggerDoc = yaml.load(publicPath);
  } catch (err) {
    log.error('Error loading public swagger:', err.message);
    publicSwaggerDoc = { info: { title: 'Error loading public docs' } };
  }

  try {
    const privatePath = path.join(__dirname, '../swagger.yaml');
    privateSwaggerDoc = yaml.load(privatePath);
  } catch (err) {
    log.error('Error loading private swagger:', err.message);
    privateSwaggerDoc = { info: { title: 'Error loading private docs' } };
  }
}

// --- INICIALIZACION de Firebase Admin SDK ---
initializeFirebaseAdmin();

// middleware global
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration for dashboard
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  process.env.DASHBOARD_URL, // Production dashboard URL from .env
];

// Allow Vercel preview and production URLs
if (process.env.VERCEL_URL) {
  allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      // Check if origin is in allowed list or matches Vercel pattern or Railway
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.railway.app') || origin.includes('peskaos-dashboard')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Role-Secret'],
  })
);

// Servir Swagger UI assets (CSS, JS, etc.)
app.use('/api-docs', swaggerUi.serve);
if (!isDevelopment) {
  app.use('/api-docs-private', swaggerUi.serve);
}

if (isDevelopment) {
  // En desarrollo: /api-docs muestra el swagger privado sin autenticación
  app.get('/api-docs', (req, res, next) => {
    return swaggerUi.setup(publicSwaggerDoc, {
      customSiteTitle: 'EcoMap API - Development (Full Documentation)',
    })(req, res, next);
  });
} else {
  // En otros entornos: /api-docs muestra público, /api-docs-private requiere autenticación
  app.get('/api-docs', (req, res, next) => {
    return swaggerUi.setup(publicSwaggerDoc, {
      customSiteTitle: 'EcoMap API - Public Documentation',
    })(req, res, next);
  });

  app.get('/api-docs-private', authenticateBackendJWT, requireAdmin, (req, res, next) => {
    return swaggerUi.setup(privateSwaggerDoc, {
      customSiteTitle: 'EcoMap API - Private Admin Documentation',
    })(req, res, next);
  });
}

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
