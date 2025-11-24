# Arquitectura del Backend - EcoMap (PESkaos-back)

## 📋 Tabla de Contenidos
- [Visión General](#visión-general)
- [Estructura de Directorios](#estructura-de-directorios)
- [Responsabilidades por Capa](#responsabilidades-por-capa)
- [Flujo de una Request](#flujo-de-una-request)
- [Convenciones de Código](#convenciones-de-código)
- [Ejemplos Prácticos](#ejemplos-prácticos)

---

## Visión General

Este backend sigue una **arquitectura en capas** (layered architecture) con separación clara de responsabilidades:

```
Cliente HTTP
    ↓
[Routes] → Define endpoints y middlewares
    ↓
[Middlewares] → Autenticación, validación, permisos
    ↓
[Controllers] → Orquestación y manejo de errores HTTP
    ↓
[Services] → Lógica de negocio y operaciones complejas
    ↓
[Lib] → Utilidades reutilizables (prisma, jwt, validators, logger)
    ↓
[Prisma ORM] → Acceso a base de datos
    ↓
PostgreSQL
```

**Capas adicionales:**
- **Config**: Configuración centralizada (Firebase, fuentes de datos, etc.)
- **Jobs**: Tareas programadas o de sincronización (cron jobs)

---

## Estructura de Directorios

```
src/
├── api/
│   ├── controllers/     # Controladores HTTP (orquestación)
│   ├── middlewares/     # Middlewares de Express (auth, validación)
│   └── routes/          # Definición de rutas y montaje
├── config/              # Configuración centralizada
├── jobs/                # Tareas programadas/background
├── lib/                 # Utilidades y helpers reutilizables
├── services/            # Lógica de negocio
└── index.js             # Punto de entrada de la aplicación

prisma/
├── schema.prisma        # Esquema de base de datos
└── migrations/          # Migraciones de BD

docs/                    # Documentación del proyecto
tests/                   # Tests unitarios e integración
```

---

## Responsabilidades por Capa

### 1️⃣ **Routes** (`src/api/routes/`)

**Responsabilidad**: Definir endpoints y aplicar middlewares.

✅ **Debe hacer:**
- Definir rutas HTTP (GET, POST, PUT, PATCH, DELETE)
- Aplicar middlewares de autenticación/autorización
- Aplicar middlewares de validación
- Documentar cada endpoint con comentarios JSDoc
- Exportar el router como `default`

❌ **NO debe hacer:**
- Contener lógica de negocio
- Acceder directamente a la base de datos
- Manejar errores (delegarlo al controller)

**Ejemplo:**
```javascript
// src/api/routes/user.routes.js
import express from 'express';
import { authenticateBackendJWT } from '#middlewares/auth.middleware.js';
import { validatePhone } from '#middlewares/validation.middleware.js';
import { getUserProfile, updateUserProfile } from '#controllers/user.controller.js';

const router = express.Router();

/**
 * @route GET /api/users/me
 * @description Obtiene el perfil del usuario autenticado
 * @access Protegido (requiere JWT)
 */
router.get('/me', authenticateBackendJWT, getUserProfile);

/**
 * @route PUT /api/users/me
 * @description Actualiza el perfil del usuario
 * @access Protegido (requiere JWT + validación de teléfono)
 */
router.put('/me', authenticateBackendJWT, validatePhone, updateUserProfile);

export default router;
```

---

### 2️⃣ **Middlewares** (`src/api/middlewares/`)

**Responsabilidad**: Interceptar requests para validar, autenticar o transformar datos.

✅ **Debe hacer:**
- Validar tokens (Firebase, JWT backend)
- Verificar permisos/roles
- Validar y normalizar datos de entrada
- Añadir información a `req.user` o `req.token`
- Responder con errores HTTP si la validación falla
- Llamar a `next()` si todo es correcto

❌ **NO debe hacer:**
- Contener lógica de negocio
- Acceder directamente a servicios externos (usar lib/ o services/)

**Ejemplo:**
```javascript
// src/api/middlewares/auth.middleware.js
import jwt from 'jsonwebtoken';
import { prisma } from '#lib/prisma.js';

export const authenticateBackendJWT = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ success: false, code: 'NO_TOKEN' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const session = await prisma.session.findUnique({ where: { jwt: token } });

    if (!session) {
      return res.status(401).json({ success: false, code: 'INVALID_SESSION' });
    }

    req.user = decoded; // { uid, email, role, ... }
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, code: 'INVALID_TOKEN' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, code: 'FORBIDDEN' });
  }
  next();
};
```

---

### 3️⃣ **Controllers** (`src/api/controllers/`)

**Responsabilidad**: Orquestar la lógica de negocio y manejar respuestas HTTP.

✅ **Debe hacer:**
- Extraer parámetros de `req.params`, `req.query`, `req.body`, `req.user`
- Llamar a funciones de servicios (`services/`)
- Construir respuestas HTTP apropiadas (status codes, JSON)
- Manejar errores con try-catch y responder con códigos HTTP correctos
- Logging de operaciones importantes

❌ **NO debe hacer:**
- Contener lógica de negocio compleja
- Hacer queries directas a Prisma (usar services/)
- Validar datos (usar middlewares o lib/validators)

**Ejemplo:**
```javascript
// src/api/controllers/user.controller.js
import { getUserById, updateUser } from '#services/user.service.js';
import { createLogger } from '#lib/logger.js';

const log = createLogger('user-controller');

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.uid; // viene del middleware
    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({ success: false, code: 'USER_NOT_FOUND' });
    }

    return res.json({ success: true, user });
  } catch (error) {
    log.error('Error getting user profile:', error);
    return res.status(500).json({ success: false, code: 'INTERNAL_ERROR' });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.uid;
    const updates = req.body; // ya validado por middlewares

    const updated = await updateUser(userId, updates);
    return res.json({ success: true, user: updated });
  } catch (error) {
    log.error('Error updating user:', error);
    return res.status(500).json({ success: false, code: 'INTERNAL_ERROR' });
  }
};
```

---

### 4️⃣ **Services** (`src/services/`)

**Responsabilidad**: Implementar lógica de negocio y operaciones con la base de datos.

✅ **Debe hacer:**
- Contener toda la lógica de negocio
- Hacer queries a Prisma
- Interactuar con APIs externas
- Implementar algoritmos complejos
- Usar transacciones cuando sea necesario
- Lanzar errores descriptivos (no códigos HTTP)
- Retornar datos planos (objetos, arrays, primitivos)

❌ **NO debe hacer:**
- Manejar requests/responses HTTP
- Acceder a `req` o `res`
- Retornar códigos de estado HTTP
- Hacer logging de HTTP (usar lib/logger para lógica interna)

**Ejemplo:**
```javascript
// src/services/cache.service.js
import { prisma } from '#lib/prisma.js';
import { createLogger } from '#lib/logger.js';

const log = createLogger('cache');

export async function getCachedPoints({ source, apiLocation, filters = {} }) {
  const meta = await ensureMetadata(source);
  const isStale = checkIfStale(meta.last_sync, source);

  // Query con filtros dinámicos
  const points = await prisma.recycling_point.findMany({
    where: {
      api_location: apiLocation,
      active: true,
      ...filters, // { api_id: 123, name: { contains: '...' } }
    },
  });

  // Trigger background refresh si está stale
  if (isStale && onRefresh) {
    triggerBackgroundRefresh({ source, refreshFn: onRefresh });
  }

  return {
    data: points,
    metadata: meta,
    isStale,
    coldStart: points.length === 0,
  };
}

export async function markStatus(source, status, patch = {}) {
  return prisma.cache_metadata.update({
    where: { source },
    data: { status, ...patch },
  });
}
```

---

### 5️⃣ **Lib** (`src/lib/`)

**Responsabilidad**: Utilidades reutilizables y helpers sin lógica de negocio.

✅ **Debe hacer:**
- Exportar utilidades puras
- Proveer helpers para Prisma, JWT, validación, logging
- Ser completamente reutilizable en cualquier capa
- No depender de contexto HTTP

❌ **NO debe hacer:**
- Contener lógica de negocio específica del dominio
- Acceder a req/res

**Ejemplos:**

```javascript
// src/lib/prisma.js
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();

// src/lib/jwt.js
import jwt from 'jsonwebtoken';

export function signUserJWT(payload) {
  const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { token, expiryDate };
}

// src/lib/validators.js
export function validatePhoneFormat(phone) {
  const phoneRegex = /^\+\d{1,4}\s\d{4,15}$/;
  return phoneRegex.test(phone?.trim());
}

export function normalizePhone(phone) {
  const cleaned = phone.replace(/\s+/g, '');
  const match = cleaned.match(/^\+(\d{1,4})(\d{4,15})$/);
  return match ? `+${match[1]} ${match[2]}` : null;
}

// src/lib/logger.js
export function createLogger(namespace = 'app') {
  return {
    info: (...args) => console.log(`[INFO][${namespace}]`, ...args),
    error: (...args) => console.error(`[ERROR][${namespace}]`, ...args),
    warn: (...args) => console.warn(`[WARN][${namespace}]`, ...args),
    debug: (...args) => console.log(`[DEBUG][${namespace}]`, ...args),
  };
}
```

---

### 6️⃣ **Config** (`src/config/`)

**Responsabilidad**: Configuración centralizada del proyecto.

✅ **Debe hacer:**
- Exportar configuraciones estáticas
- Mapear variables de entorno
- Definir constantes del proyecto
- Proveer funciones helper para acceder a configuración

❌ **NO debe hacer:**
- Contener lógica de negocio
- Hacer queries a BD

**Ejemplo:**
```javascript
// src/config/recycling-sources.config.js
import { syncNavarraPoints } from '#services/navarra-sync.service.js';
import { syncBarcelonaPoints } from '#services/barcelona-sync.service.js';

export const RECYCLING_SOURCES = {
  navarra: {
    source: 'NAVARRA_POINTS',
    apiLocation: 'Navarra',
    syncFn: syncNavarraPoints,
    cron: '0 * * * *', // cada hora
    ttl: 90 * 60 * 1000, // 1h 30min
    syncInterval: 60 * 60 * 1000, // 1h
  },
  barcelona: {
    source: 'BARCELONA_POINTS',
    apiLocation: 'Barcelona',
    syncFn: syncBarcelonaPoints,
    cron: '15 * * * *',
    ttl: 90 * 60 * 1000,
    syncInterval: 60 * 60 * 1000,
  },
};

export function getSourceConfig(location) {
  return RECYCLING_SOURCES[location?.toLowerCase()] || null;
}

export function isLocationSupported(location) {
  return !!RECYCLING_SOURCES[location?.toLowerCase()];
}
```

---

### 7️⃣ **Jobs** (`src/jobs/`)

**Responsabilidad**: Tareas programadas o de fondo (cron jobs, sincronización).

✅ **Debe hacer:**
- Ejecutar tareas de sincronización periódicas
- Coordinarse con servicios para ejecutar lógica de negocio
- Actualizar metadata de estado (syncing, ready, error)
- Ser idempotentes (evitar ejecuciones duplicadas)
- Hacer logging detallado

❌ **NO debe hacer:**
- Manejar requests HTTP
- Contener lógica de negocio (delegar a services/)

**Ejemplo:**
```javascript
// src/jobs/sync-points.job.js
import { prisma } from '#lib/prisma.js';
import { markStatus, ensureMetadata } from '#services/cache.service.js';
import { createLogger } from '#lib/logger.js';

const log = createLogger('sync-job');

export async function runSyncJob({ source, syncFn, apiLocation }) {
  const meta = await ensureMetadata(source);

  // Evitar overlapping
  if (meta.status === 'SYNCING') {
    log.info(`${source} sync skipped: already in progress`);
    return { success: false, skipped: true };
  }

  await markStatus(source, 'SYNCING');

  try {
    const result = await syncFn(); // delegar a service
    const total = await prisma.recycling_point.count({
      where: { api_location: apiLocation, active: true },
    });

    await markStatus(source, 'READY', {
      last_sync: new Date(),
      total_records: total,
      error_message: null,
    });

    log.info(`${source} sync OK: ${result.inserted} inserted, ${result.updated} updated`);
    return { success: true, ...result, totalRecords: total };
  } catch (error) {
    await markStatus(source, 'ERROR', {
      error_message: error.message.slice(0, 500),
    });
    log.error(`${source} sync failed:`, error);
    return { success: false, error: error.message };
  }
}
```

---

## Flujo de una Request

### Ejemplo: `PUT /api/users/me` (actualizar perfil)

1. **Route** (`user.routes.js`):
   ```javascript
   router.put('/me', authenticateBackendJWT, validatePhone, updateUserProfile);
   ```

2. **Middleware** (`auth.middleware.js`):
   - Verifica JWT → extrae `req.user = { uid, email, role, ... }`
   - Si falla → `401 Unauthorized`

3. **Middleware** (`validation.middleware.js`):
   - Valida y normaliza `req.body.phone`
   - Si falla → `400 Bad Request`

4. **Controller** (`user.controller.js`):
   ```javascript
   export const updateUserProfile = async (req, res) => {
     try {
       const userId = req.user.uid;
       const updates = req.body;
       const updated = await updateUser(userId, updates); // → service
       return res.json({ success: true, user: updated });
     } catch (error) {
       log.error('Error updating user:', error);
       return res.status(500).json({ success: false, code: 'INTERNAL_ERROR' });
     }
   };
   ```

5. **Service** (`user.service.js`):
   ```javascript
   export async function updateUser(userId, updates) {
     return prisma.registered_user.update({
       where: { user_id: userId },
       data: updates,
     });
   }
   ```

6. **Response**: `200 OK` con el usuario actualizado.

---

## Convenciones de Código

### Imports
- Usar **alias de rutas** con `#`:
  ```javascript
  import { prisma } from '#lib/prisma.js';
  import { authenticateBackendJWT } from '#middlewares/auth.middleware.js';
  import { getUserById } from '#services/user.service.js';
  ```

### Naming
- **Archivos**: `kebab-case.js` (ej: `user.controller.js`, `auth.middleware.js`)
- **Funciones**: `camelCase` (ej: `getUserProfile`, `syncNavarraPoints`)
- **Constantes**: `UPPER_SNAKE_CASE` (ej: `JWT_SECRET`, `RECYCLING_SOURCES`)
- **Variables**: `camelCase` (ej: `userId`, `isStale`)

### Exports
- **Routes/Config/Services**: `export default` para routers y configuraciones principales
- **Utilities/Helpers**: `export` nombrado para funciones específicas

### Error Handling
- **Controllers**: Usar try-catch y retornar códigos HTTP apropiados
- **Services**: Lanzar errores con mensajes descriptivos (`throw new Error('USER_NOT_FOUND')`)
- **Middlewares**: Responder con errores HTTP si fallan validaciones

### Logging
- Usar `createLogger(namespace)` de `#lib/logger.js`
- Niveles: `error`, `warn`, `info`, `debug`, `trace`
- Incluir contexto útil (IDs, timestamps, operación)

### Comentarios
- Documentar endpoints con JSDoc en routes
- Comentarios inline solo para lógica compleja
- No comentar código obvio

---

## Ejemplos Prácticos

### Crear un nuevo endpoint completo

#### 1. Definir el modelo en Prisma (si es necesario)
```prisma
// prisma/schema.prisma
model chat {
  chat_id    String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user1_id   String
  user2_id   String
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  messages   message[]
  
  @@unique([user1_id, user2_id])
}
```

#### 2. Crear el servicio
```javascript
// src/services/chat.service.js
import { prisma } from '#lib/prisma.js';

export async function createOrGetChat(user1Id, user2Id) {
  const [u1, u2] = user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
  
  const existing = await prisma.chat.findUnique({
    where: { user1_id_user2_id: { user1_id: u1, user2_id: u2 } },
  });
  
  if (existing) return existing;
  
  return prisma.chat.create({
    data: { user1_id: u1, user2_id: u2 },
  });
}

export async function listChatsForUser(userId) {
  return prisma.chat.findMany({
    where: {
      OR: [{ user1_id: userId }, { user2_id: userId }],
    },
    orderBy: { updated_at: 'desc' },
  });
}
```

#### 3. Crear el controlador
```javascript
// src/api/controllers/chat.controller.js
import { createOrGetChat, listChatsForUser } from '#services/chat.service.js';
import { createLogger } from '#lib/logger.js';

const log = createLogger('chat');

export const postChat = async (req, res) => {
  try {
    const { user1_id, user2_id } = req.body;
    
    if (!user1_id || !user2_id) {
      return res.status(400).json({ success: false, error: 'MISSING_USER_IDS' });
    }
    
    const chat = await createOrGetChat(user1_id, user2_id);
    return res.status(201).json({ chat });
  } catch (error) {
    log.error('Error creating chat:', error);
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
};

export const getChats = async (req, res) => {
  try {
    const userId = req.user.uid;
    const chats = await listChatsForUser(userId);
    return res.json({ chats });
  } catch (error) {
    log.error('Error listing chats:', error);
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
};
```

#### 4. Crear las rutas
```javascript
// src/api/routes/chat.routes.js
import express from 'express';
import { authenticateBackendJWT } from '#middlewares/auth.middleware.js';
import { postChat, getChats } from '#controllers/chat.controller.js';

const router = express.Router();

/**
 * @route POST /api/chats
 * @description Crea o retorna un chat existente entre dos usuarios
 * @access Protegido (requiere JWT)
 */
router.post('/', authenticateBackendJWT, postChat);

/**
 * @route GET /api/chats
 * @description Lista todos los chats del usuario autenticado
 * @access Protegido (requiere JWT)
 */
router.get('/', authenticateBackendJWT, getChats);

export default router;
```

#### 5. Montar las rutas en el servidor
```javascript
// src/index.js
import chatRoutes from './api/routes/chat.routes.js';

app.use('/api/chats', chatRoutes);
```

---

## Checklist para nuevas features

Cuando implementes una nueva funcionalidad, asegúrate de:

- [ ] Definir/actualizar modelos en `prisma/schema.prisma`
- [ ] Crear migración: `npx prisma migrate dev --name <nombre>`
- [ ] Implementar lógica de negocio en `services/`
- [ ] Crear controladores en `api/controllers/`
- [ ] Crear middlewares de validación si es necesario
- [ ] Definir rutas en `api/routes/`
- [ ] Montar rutas en `src/index.js`
- [ ] Añadir logging apropiado
- [ ] Manejar errores en todos los niveles
- [ ] Documentar endpoints con comentarios JSDoc
- [ ] Crear tests en `tests/`
- [ ] Actualizar documentación en `docs/`

---

## Resumen de Responsabilidades

| Capa         | Acceso a DB | Lógica de Negocio | Manejo HTTP | Validación | Reutilizable |
|--------------|-------------|-------------------|-------------|------------|--------------|
| Routes       | ❌          | ❌                | ✅          | ❌         | ❌           |
| Middlewares  | ⚠️ (mínimo) | ❌                | ✅          | ✅         | ✅           |
| Controllers  | ❌          | ❌                | ✅          | ❌         | ❌           |
| Services     | ✅          | ✅                | ❌          | ❌         | ✅           |
| Lib          | ⚠️ (client) | ❌                | ❌          | ✅         | ✅           |
| Config       | ❌          | ❌                | ❌          | ❌         | ✅           |
| Jobs         | ⚠️ (metadata) | ❌              | ❌          | ❌         | ✅           |

**Leyenda:**
- ✅ = Responsabilidad principal
- ⚠️ = Permitido pero limitado
- ❌ = No debe hacerlo

---

## Recursos Adicionales

- [Documentación de Prisma](https://www.prisma.io/docs)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Node.js Error Handling](https://nodejs.org/en/docs/guides/error-handling/)
