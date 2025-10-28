# Sistema de Caché Multi-Zona para Puntos de Reciclaje

Este documento describe el sistema de caché implementado para optimizar las consultas a las APIs públicas de puntos de reciclaje (Navarra, Barcelona, etc.).

---

## 📋 Problema a Resolver

Las APIs públicas de puntos de reciclaje, especialmente la de Navarra (al accederse a través de un proxy de Cloudflare), tienen tiempos de respuesta muy lentos (~20 segundos). Esto genera una mala experiencia de usuario si cada consulta debe esperar ese tiempo.

---

## ✅ Solución: Sistema de Caché Multi-Zona con Sincronización en Background

Implementar un sistema de caché persistente y escalable en PostgreSQL que:
1. **Sirve datos instantáneamente** desde la base de datos (< 100ms)
2. **Actualiza automáticamente** la información mediante jobs en background (configurables por zona)
3. **Mantiene disponibilidad** incluso si las APIs externas fallan temporalmente
4. **Soporta múltiples zonas** de forma centralizada y fácilmente extensible
5. **Protege endpoints administrativos** con control de acceso basado en roles

---

## 🏗️ Arquitectura del Sistema

### Componentes Principales

1. **Recycling Sources Config** - Configuración centralizada de todas las zonas (Navarra, Barcelona, etc.)
2. **Cache Service** - Gestiona la lógica de caché genérica y validación de freshness
3. **Sync Services** - Servicios específicos por zona que sincronizan con APIs externas
4. **Background Scheduler (Cron)** - Ejecuta sincronizaciones periódicas para cada zona
5. **Generic Controllers & Routes** - Endpoints parametrizados por región
6. **Auth Middleware** - Control de acceso basado en roles JWT (admin, client, institution)

### Diagrama de Flujo Multi-Zona

```
┌─────────────────────────────────────────────────────────────┐
│                      USUARIO (Frontend)                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ GET /api/recycling-points/:region
                      │ (region = navarra, barcelona, etc.)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│             API ENDPOINT (Generic Controller)                │
│  1. Validar región (getSourceConfig)                         │
│  2. Consultar cache_metadata para esa zona                   │
│  3. ¿Existe caché?                                           │
│     ├─ SÍ → Servir datos (< 100ms)                          │
│     │       + Si stale: trigger refresh background           │
│     └─ NO → Fetch API + Guardar + Servir (20s - solo 1ª vez)│
└─────────────────────────────────────────────────────────────┘
                      │
                      │ Consulta DB
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL (Prisma)                        │
│  - recycling_point (datos de puntos, todas las zonas)       │
│  - cache_metadata (control de sync por zona)                 │
└─────────────────────────────────────────────────────────────┘
                      ▲
                      │ Sincroniza según config de cada zona
                      │
┌─────────────────────────────────────────────────────────────┐
│          BACKGROUND SCHEDULER (Multi-Zone Cron)              │
│  Para cada zona en RECYCLING_SOURCES:                        │
│    1. Crear tarea cron con expresión específica              │
│    2. Ejecutar runSyncJob con config de la zona              │
│    3. Evitar solapamiento (check status)                     │
│    4. Actualizar cache_metadata                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Llamadas a APIs externas
                      ▼
┌──────────────────────────────┬──────────────────────────────┐
│      API PÚBLICA NAVARRA      │   API PÚBLICA BARCELONA     │
│   (Cloudflare Proxy - 20s)   │      (Open Data - 5s)       │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 🗂️ Configuración Centralizada Multi-Zona

### Archivo: `src/config/recycling-sources.config.js`

Este archivo centraliza toda la configuración de zonas. **Añadir una nueva zona es tan simple como agregar una entrada aquí.**

```javascript
export const RECYCLING_SOURCES = {
  navarra: {
    source: 'NAVARRA_POINTS',          // Key en cache_metadata
    apiLocation: 'Navarra',             // Valor del enum api_location en Prisma
    syncFn: syncNavarraPoints,          // Función específica de sincronización
    cron: '0 * * * *',                  // Cron: cada hora en punto (:00)
    ttl: 90 * 60 * 1000,                // TTL: 1h 30min (cuándo se marca stale)
    syncInterval: 60 * 60 * 1000,       // Intervalo: 1h (cuándo refrescar)
  },
  barcelona: {
    source: 'BARCELONA_POINTS',
    apiLocation: 'Barcelona',
    syncFn: syncBarcelonaPoints,
    cron: '15 * * * *',                 // Offset 15min para evitar overlap
    ttl: 120 * 60 * 1000,               // TTL: 2h
    syncInterval: 90 * 60 * 1000,       // Intervalo: 1h 30min
  },
  // Fácilmente extensible...
};
```

### Funciones Helper

```javascript
// Obtener configuración por región
getSourceConfig('navarra') // → objeto config completo

// Obtener todas las regiones disponibles
getAvailableLocations() // → ['navarra', 'barcelona']

// Verificar si una región está soportada
isLocationSupported('madrid') // → false
```

---

## ⚙️ Configuración de Tiempos por Zona

| Zona      | TTL (Stale) | Sync Interval | Cron Expression | Justificación                           |
|-----------|-------------|---------------|------------------|-----------------------------------------|
| Navarra   | 1h 30min    | 1h            | `0 * * * *`      | API lenta, datos estables               |
| Barcelona | 2h          | 1h 30min      | `15 * * * *`     | API rápida, offset para evitar overlap  |

### Justificación General

- **TTL > Sync Interval**: Margen de seguridad (30 min típico)
- **Offsets en cron**: Evitar que todas las zonas sincronicen simultáneamente
- **Sync intervals variables**: Adaptados a la frecuencia de cambio de datos de cada API

---

## 🗄️ Esquema de Base de Datos

### Tabla: `cache_metadata`

Controla el estado de sincronización de cada zona.

```prisma
model cache_metadata {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  source          String   @unique // 'NAVARRA_POINTS', 'BARCELONA_POINTS', etc.
  last_sync       DateTime? // Última sincronización exitosa
  next_sync       DateTime? // Próxima sincronización programada
  status          cache_status @default(READY) // SYNCING | READY | ERROR
  error_message   String?  // Mensaje de error si status = ERROR
  total_records   Int      @default(0) // Total de puntos en caché para esta zona
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
}

enum cache_status {
  SYNCING  // Sincronización en progreso
  READY    // Caché lista para usar
  ERROR    // Error en última sincronización
}
```

**Nota**: Un registro por cada zona configurada en `RECYCLING_SOURCES`.

### Tabla: `recycling_point`

Almacena los puntos de reciclaje de todas las zonas.

```prisma
model recycling_point {
  recycling_point_id String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  api_id             Int          // ID del punto en la API externa
  api_location       api_location // Enum: NAVARRA | BARCELONA | ...
  active             Boolean      @default(true) // Desactivar en vez de eliminar
  // ... otros campos (lat, lng, nombre, dirección, etc.)
  container          container[]
  timetable          timetable[]
  created_at         DateTime     @default(now())
  updated_at         DateTime     @updatedAt
}

enum api_location {
  Navarra
  Barcelona
  // Fácilmente extensible
}
```

**Nota**: Todos los puntos de todas las zonas en una misma tabla, diferenciados por `api_location`.

---

## 🔄 Flujos Detallados

### 1. Primera Consulta (Cold Start)

```
Usuario → GET /api/recycling-points/navarra
    ↓
1. Validar región (getSourceConfig('navarra'))
   ↓
2. Consultar cache_metadata WHERE source = 'NAVARRA_POINTS'
   ↓
   ¿Existe registro?
   ↓ NO (primera vez)
   ↓
3. Crear registro cache_metadata con status = SYNCING
4. Ejecutar syncNavarraPoints() (20 segundos)
5. Guardar puntos en recycling_point con api_location = 'Navarra'
6. Actualizar cache_metadata:
   - status = READY
   - last_sync = NOW()
   - next_sync = NOW() + ttl
   - total_records = COUNT(puntos)
7. Devolver datos al usuario
```

**Tiempo de respuesta**: ~20 segundos (solo la primera vez por zona)

---

### 2. Consultas Posteriores (Cache Hit)

```
Usuario → GET /api/recycling-points/navarra
    ↓
1. Validar región
2. Consultar cache_metadata WHERE source = 'NAVARRA_POINTS'
   ↓
   ¿Existe Y last_sync reciente (< TTL)?
   ↓ SÍ (caché válida y fresca)
   ↓
3. SELECT * FROM recycling_point 
   WHERE api_location = 'Navarra' AND active = true
4. Devolver datos al usuario
```

**Tiempo de respuesta**: < 100ms ✅

---

### 3. Caché Stale (Expirada) - Servir y Actualizar en Background

```
Usuario → GET /api/recycling-points/navarra
    ↓
1. Consultar cache_metadata
   ↓
   ¿last_sync > TTL (stale)?
   ↓ SÍ (caché expirada pero existe)
   ↓
2. SELECT puntos y devolver INMEDIATAMENTE (< 100ms)
3. En paralelo (sin bloquear respuesta):
   a. Verificar que status != SYNCING
   b. Si no hay sync → Trigger actualización async en background
   c. Background ejecuta syncFn de la zona
4. Próxima consulta ya tendrá datos frescos
```

**Tiempo de respuesta**: < 100ms ✅ (usuario nunca espera)

**Filosofía**: **Stale-While-Revalidate (SWR)**. Es mejor mostrar datos de hace 2 horas que hacer esperar 20 segundos.

---

### 4. Sincronización en Background (Cron Job Multi-Zona)

```
Scheduler inicia al arrancar el servidor:
    ↓
Para cada zona en RECYCLING_SOURCES:
    ↓
1. Crear tarea cron con expresión específica
   Ejemplo: Navarra → '0 * * * *' (cada hora en punto)
            Barcelona → '15 * * * *' (cada hora a los 15min)
    ↓
Cuando el cron se ejecuta para una zona:
    ↓
2. Verificar cache_metadata de esa zona
   ↓
   ¿status = SYNCING?
   ↓ SÍ → SALIR (evitar solapamiento)
   ↓ NO → Continuar
    ↓
3. Actualizar status = SYNCING
    ↓
4. Ejecutar syncFn de la zona (ej: syncNavarraPoints)
   - Consultar API externa
   - Comparar datos nuevos vs existentes
    ↓
5. Para cada punto de la API:
   - ¿Existe en BD (mismo api_id + api_location)?
     ├─ NO → INSERT nuevo punto
     └─ SÍ → ¿Datos diferentes?
         ├─ SÍ → UPDATE punto
         └─ NO → Skip
   
   Puntos en BD que no están en API:
   - Marcar active = false (soft delete)
    ↓
6. Actualizar cache_metadata:
   - status = READY
   - last_sync = NOW()
   - next_sync = NOW() + syncInterval
   - total_records = COUNT(puntos activos)
   - error_message = NULL
    ↓
7. Log resultado: [ZONA] X insertados, Y actualizados, Z desactivados
```

**Ventaja**: Los usuarios nunca esperan; cada zona se actualiza independientemente.

---

## 🚨 Manejo de Errores

### Error en Sincronización Background

```
Si falla consulta a API externa durante cron:
    ↓
1. Actualizar cache_metadata de esa zona:
   - status = ERROR
   - error_message = "Descripción del error"
   - last_sync NO cambiar (mantener timestamp del último éxito)
    ↓
2. Log del error con detalles: [ERROR] [ZONA] Sync failed: ...
    ↓
3. Mantener datos existentes en caché
   (mejor servir datos antiguos que no servir nada)
    ↓
4. Próximo cron (según intervalo configurado) reintentará automáticamente
    ↓
5. Si múltiples fallos consecutivos (ej: 3+):
   - Endpoint /status mostrará status = ERROR
   - Administradores pueden ver error_message
   - Considerar alertas/notificaciones
```

### Error en Primera Consulta (Cold Start)

```
Si falla la primera consulta cuando NO hay caché:
    ↓
1. Devolver error 503 Service Unavailable al usuario
2. Mensaje: "Servicio de puntos de reciclaje temporalmente no disponible"
3. Marcar cache_metadata con status = ERROR
4. Usuario puede reintentar en unos segundos
5. Background job reintentará sync en el próximo ciclo
```

**Nota**: Solo ocurre en cold start. Una vez hay caché, siempre se sirven datos (aunque sean stale).

### Región No Soportada

```
Si usuario consulta región no configurada:
    ↓
GET /api/recycling-points/madrid
    ↓
2. Devolver error 404 Not Found
3. Mensaje: "Región no soportada. Regiones disponibles: navarra, barcelona"
```

---

## 🌐 Endpoints de API

> 📖 **Documentación completa**: Ver archivos en `docs/api/endpoints/`

### 1. Obtener Puntos de Reciclaje (Público)

```
GET /api/recycling-points/:region
```

**Parámetros**:
- `region` (path): Región a consultar (`navarra`, `barcelona`, etc.)

**Descripción**: Devuelve la lista de puntos de reciclaje desde la caché. Acceso público sin autenticación.

**Comportamiento SWR**: 
- Si caché fresca → Devuelve datos instantáneamente
- Si caché stale → Devuelve datos existentes + refresca en background
- Si no hay caché → Fetch inicial (20s, solo primera vez)

**Response 200 OK**:
```json
  "success": true,
    {
      "recycling_point_id": "uuid",
      "api_id": 123,
      "api_location": "Navarra",
      "lat": 42.xxx,
      "lng": -1.xxx,
      "active": true,
      // ... más campos
    }
  ],
  "metadata": {
    "total": 150,
    "region": "navarra",
    "last_updated": "2025-10-28T10:30:00Z"
  }
}
```

📖 [Ver documentación completa →](api/endpoints/recycling-points-region.md)

---

### 2. Estado de la Caché (Admin Only)

```
GET /api/recycling-points/:region/status
```

**Descripción**: Devuelve información sobre el estado de la caché de una zona. Útil para dashboards de monitoreo.

    "source": "NAVARRA_POINTS",
    "status": "READY",
    "total_records": 150,
    "minutes_since_sync": 25,
}
```
- `READY`: Caché lista y funcionando
- `SYNCING`: Sincronización en progreso
- `ERROR`: Error en última sincronización (ver `error_message`)

📖 [Ver documentación completa →](api/endpoints/recycling-points-status.md)

---

### 3. Forzar Actualización Manual (Admin Only)


---

## 🔐 Control de Acceso (Role-Based)

### Middlewares de Autenticación

#### `authenticateBackendJWT`
- Valida el JWT del backend
- Verifica sesión en base de datos
- Adjunta `req.user` con payload decodificado (incluye `role`)

#### `requireAdmin`
- Verifica `req.user.role === 'admin'`
- Retorna 403 FORBIDDEN si no es admin
- **Uso**: Proteger endpoints `/status` y `/refresh`

#### `requireInstitution`
- Verifica `req.user.role === 'institution'`
- Retorna 403 FORBIDDEN si no es institution

#### `requireAdminOrInstitution`
- Verifica `req.user.role` en `['admin', 'institution']`
- Retorna 403 FORBIDDEN si no cumple

### Cadena de Middlewares

```javascript
// Endpoint público
router.get('/:region', getPointsByRegion);

// Endpoint admin
router.get('/:region/status', authenticateBackendJWT, requireAdmin, getStatusByRegion);
router.post('/:region/refresh', authenticateBackendJWT, requireAdmin, forceRefreshByRegion);
```
```
```

**Autenticación**: ✅ Backend JWT con `role: "admin"`

**Descripción**: Fuerza una sincronización inmediata con la API externa de la zona. **Operación lenta** (20-30s).

**Response 200 OK**:
```json
{
  "success": true,
  "message": "Sincronización completada exitosamente.",
  "data": {
    "region": "navarra",
    "inserted": 5,
    "updated": 12,
    "deactivated": 2,
    "total_records": 150,
    "sync_duration_ms": 19234
  }
}
```

**Response 409 Conflict** (si ya hay sync en progreso):
```json
{
// Inicio del scheduler
[SCHEDULER] Starting cron jobs for 2 zones: navarra, barcelona

// Cada sincronización exitosa
[SYNC] [NAVARRA] Points synced: +5 inserted, 12 updated, -2 deactivated (150 total) in 19.2s

// Error en sincronización
[ERROR] [BARCELONA] Sync failed: Connection timeout after 30s

// Caché servida (público)
[CACHE] [NAVARRA] Served 150 points from cache (age: 25min, fresh)

// Caché stale + background refresh
[CACHE] [NAVARRA] Served 150 points from cache (age: 95min, stale) → triggering background refresh

// Cold start
[CACHE] [NAVARRA] Cold start: no cache found, fetching from API (20.1s)

// Admin fuerza refresh
[ADMIN] [NAVARRA] Manual refresh triggered by user admin@example.com
```

### Métricas a Monitorear

1. **Tiempo de respuesta del endpoint**: Debe ser < 200ms con caché
2. **Tasa de éxito del cron por zona**: Debe ser > 95%
3. **Edad promedio de la caché por zona**: Debe estar dentro del TTL configurado
4. **Errores consecutivos**: Alertar si > 3 para cualquier zona
5. **Status de cache_metadata**: Monitorear zonas en ERROR
  "success": false,
  "code": "SYNC_IN_PROGRESS"
}
```

📖 [Ver documentación completa →](api/endpoints/recycling-points-refresh.md)

---

## 🚀 Ventajas del Sistema Multi-Zona

1. ✅ **Experiencia de usuario mejorada**: 20s → < 100ms (200x más rápido)
2. ✅ **Escalabilidad**: Miles de usuarios consultan sin saturar APIs externas
3. ✅ **Alta disponibilidad**: Funciona incluso si APIs externas caen temporalmente
4. ✅ **Datos actualizados**: Refresh automático según config de cada zona
5. ✅ **Sin intervención manual**: Todo funciona en background
6. ✅ **Auditabilidad**: Se sabe cuándo y cómo se actualizó cada zona
7. ✅ **Recuperación automática**: Si falla un sync, el siguiente lo reintenta
8. ✅ **Fácilmente extensible**: Añadir nueva zona = modificar 1 archivo de config
9. ✅ **Control de acceso**: Endpoints admin protegidos con roles JWT
10. ✅ **Independencia entre zonas**: Cada zona tiene su propio TTL, cron, y estado

---

## ➕ Cómo Añadir una Nueva Zona

### Ejemplo: Añadir Madrid

**Paso 1**: Crear servicio de sincronización específico

```javascript
// src/services/madrid-sync.service.js
export async function syncMadridPoints() {
  // 1. Consultar API de Madrid
  const response = await fetch('https://api.madrid.es/recycling-points');
  const data = await response.json();
  
  // 2. Mapear a estructura común
  const points = data.map(point => ({
    api_id: point.id,
    api_location: 'Madrid',
    lat: point.latitude,
    lng: point.longitude,
    // ... otros campos
  }));
  
  // 3. Retornar para que runSyncJob maneje el upsert
  return points;
}
```

**Paso 2**: Añadir a configuración centralizada

```javascript
// src/config/recycling-sources.config.js
import { syncMadridPoints } from '#services/madrid-sync.service.js';

export const RECYCLING_SOURCES = {
  // ... zonas existentes
  madrid: {
    source: 'MADRID_POINTS',
    apiLocation: 'Madrid',
    syncFn: syncMadridPoints,
    cron: '30 * * * *',            // Cada hora a los 30min
    ttl: 120 * 60 * 1000,          // 2h
    syncInterval: 90 * 60 * 1000,  // 1h 30min
  },
};
```

**Paso 3**: Añadir enum en Prisma

```prisma
enum api_location {
  Navarra
  Barcelona
  Madrid  // ← Nuevo
}
```

**Paso 4**: Ejecutar migración

```bash
npx prisma migrate dev --name add_madrid_location
```

**Paso 5**: ✅ ¡Listo!

El sistema automáticamente:
- Creará el cron job para Madrid
- Manejará `/api/recycling-points/madrid`
- Manejará `/api/recycling-points/madrid/status` (admin)
- Manejará `/api/recycling-points/madrid/refresh` (admin)

**No se necesita**:
- ❌ Nuevos controllers
- ❌ Nuevas rutas
- ❌ Nuevos jobs
- ❌ Modificar scheduler

### Dependencias Necesarias

```json
{
  "node-cron": "^3.0.3",        // Para scheduling de jobs
  "axios": "^1.6.0"             // Para consultas HTTP (si no existe)
}
```
---

### Posibles Mejoras

1. **Webhooks**: Si APIs externas implementan webhooks, actualizar caché al instante
2. **Filtros geográficos**: Caché por subzonas (provincias, municipios)
3. **Compresión**: Comprimir respuestas JSON para reducir bandwidth
4. **Health check endpoint**: Para monitoreo externo (Uptime Kuma, Datadog, etc.)
5. **Métricas en dashboard**: Visualizar estado de todas las zonas en panel admin
6. **Alertas automáticas**: Notificaciones cuando una zona tiene status ERROR > X minutos
7. **Rate limiting**: Proteger endpoint `/refresh` de abuso (max 1 por zona cada 5min)
8. **Cache warming**: Pre-cargar caché al desplegar (evitar cold start para usuarios)
9. **Multi-región CDN**: Distribuir caché geográficamente para latencias ultra-bajas
10. **Versionado de API**: Mantener múltiples versiones de endpoints para backward compatibility

---

## 📊 Monitoreo y Logs

### Logs Importantes

```javascript
// Cada sincronización exitosa
[SYNC] Navarra points synced: +5 inserted, 12 updated, -2 deleted (150 total) in 19.2s

// Error en sincronización
[ERROR] Navarra sync failed: Connection timeout after 30s

// Caché servida
[CACHE] Navarra points served from cache (age: 25min, 150 records)

// Cold start
[CACHE] Navarra points cold start: fetching from API (20.1s)
```

### Métricas a Monitorear

1. **Tiempo de respuesta del endpoint**: Debe ser < 200ms con caché
2. **Tasa de éxito del cron**: Debe ser > 95%
3. **Edad promedio de la caché**: Debe ser < 1 hora
4. **Errores consecutivos**: Alertar si > 3

---

## 🚀 Ventajas del Sistema

1. ✅ **Experiencia de usuario mejorada**: 20s → < 100ms (200x más rápido)
2. ✅ **Escalabilidad**: Miles de usuarios pueden consultar sin saturar API externa
3. ✅ **Alta disponibilidad**: Funciona incluso si API Navarra cae temporalmente
4. ✅ **Datos actualizados**: Refresh automático cada hora
5. ✅ **Sin intervención manual**: Todo funciona en background
6. ✅ **Auditabilidad**: Se sabe cuándo y cómo se actualizó la caché
7. ✅ **Recuperación automática**: Si falla un sync, el siguiente lo reintenta

---

## 📝 Tareas de Implementación

- [ ] Crear migración Prisma para tabla `cache_metadata` y enum `cache_status`
- [ ] Implementar `cache.service.js` (verificar freshness, get/set)
- [ ] Implementar `navarra-sync.service.js` (fetch API, compare, upsert)
- [ ] Implementar `scheduler.service.js` (configurar cron)
- [ ] Crear job `sync-navarra-points.job.js`
- [ ] Implementar controller y routes para endpoints
- [ ] Integrar cron en `src/index.js` (iniciar al arrancar servidor)
- [ ] Añadir configuración en `config/index.js`
- [ ] Testing: primera carga, cache hit, refresh, error handling
- [ ] Documentar endpoints en `docs/api/endpoints/`

---

## 🔮 Futuras Mejoras

1. **Webhook de notificación**: Si API Navarra implementa webhooks, actualizar caché al instante
2. **Caché por región**: Si hay muchos puntos, cachear por provincia/zona
3. **Compresión**: Comprimir respuestas JSON para reducir bandwidth
4. **Health check endpoint**: Para monitoreo externo (Uptime Kuma, etc.)
5. **Métricas en dashboard**: Visualizar estado de caché en panel admin
