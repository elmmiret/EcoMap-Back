import express from 'express';
import { initializeFirebaseAdmin } from './config/firebase.js';
import { startSchedulers, warmupCaches } from '#services/scheduler.service.js';
import authRoutes from './api/routes/user.routes.js';
import recyclingPoints from './api/routes/recycling-points.routes.js';
import routeRoutes from './api/routes/route.routes.js';
import publicationRoutes from './api/routes/publication.routes.js';
import dotenv from 'dotenv';
import { createLogger } from '#lib/logger.js';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerDocument = yaml.load(path.join(__dirname, '../swagger.yaml'));

const log = createLogger('startup');

// cargar variables de entorno desde .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- INICIALIZACION de Firebase Admin SDK ---
initializeFirebaseAdmin();

// middleware global
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ruta para la documentación de la API
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// montar las rutas de autentificación bajo el prefijo /api/users
app.use('/api/users', authRoutes);
app.use('/api/recycling-points', recyclingPoints);
app.use('/api/routes', routeRoutes);
app.use('/api/publications', publicationRoutes);

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
  log.info(`Servidor Express corriendo en http://localhost:${PORT}`);

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
