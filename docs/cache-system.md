# Sistema de Caché Multi‑Zona para Puntos de Reciclaje (v2)

## TL;DR

- Caché persistente en PostgreSQL para servir puntos en < 100ms.
- Sincronización por zona en background con cron y SWR (stale‑while‑revalidate).
- Warmup y cron SOLO en producción (`NODE_ENV=production`).
- Observabilidad configurable con `LOG_LEVEL` y `LOG_NAMESPACES`.

---

## Objetivos

- Reducir latencia de consultas (APIs externas lentas, Navarra ~20s).
- Asegurar disponibilidad incluso con fallos de APIs externas.
- Soportar múltiples zonas con configuración centralizada y extensible.
- Evitar solapamientos y minimizar carga externa.

---

## Arquitectura (visión general)

Componentes:
- Config centralizada de fuentes (`RECYCLING_SOURCES`).
- Cache Service (lógica SWR, freshness, metadata).
- Sync Services por zona (Navarra, Barcelona, …).
- Scheduler (cron multi‑zona) + warmup en arranque (solo prod).
- Controllers genéricos y rutas por región.
- Auth middleware (roles admin/institution para endpoints de administración).

Flujo (resumen):
```
Cliente → GET /api/recycling-points/:region
  → Controller valida región y consulta cache_metadata
  → Si hay caché fresca → devolver en <100ms
  → Si hay caché stale → devolver en <100ms y refrescar en background
  → Si NO hay caché → primera carga bloqueante (~20s) y servir
DB: recycling_point (datos) + cache_metadata (estado por zona)
Scheduler: cron por zona, evita solapes, actualiza metadata
```

---

## Configuración centralizada

Archivo: `src/config/recycling-sources.config.js`

```js
export const RECYCLING_SOURCES = {
  navarra: {
    source: 'NAVARRA_POINTS',
    apiLocation: 'Navarra', // Enum Prisma
    syncFn: syncNavarraPoints,
    cron: '0 * * * *',      // Cada hora en punto
    ttl: 90 * 60 * 1000,    // 1h 30m
    syncInterval: 60 * 60 * 1000, // 1h
  },
  barcelona: {
    source: 'BARCELONA_POINTS',
    apiLocation: 'Barcelona',
    syncFn: syncBarcelonaPoints,
    cron: '15 * * * *',     // Offset 15m
    ttl: 120 * 60 * 1000,   // 2h
    syncInterval: 90 * 60 * 1000, // 1h 30m
  },
};
```

Helpers:
```js
getSourceConfig('navarra'); // → config de esa región
getAvailableLocations();    // → ['navarra', 'barcelona']
isLocationSupported('x');   // → boolean
```

---

## Modelo de datos (Prisma)

`cache_metadata` (estado por zona):
```prisma
model cache_metadata {
  id            String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  source        String       @unique
  last_sync     DateTime?
  next_sync     DateTime?
  status        cache_status @default(READY)
  error_message String?
  total_records Int          @default(0)
  created_at    DateTime     @default(now())
  updated_at    DateTime     @updatedAt
}

enum cache_status {
  SYNCING
  READY
  ERROR
}
```

`recycling_point` (datos por zona):
```prisma
model recycling_point {
  recycling_point_id String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  api_id             Int
  api_location       api_location
  active             Boolean      @default(true)
  // ... más campos (lat, lng, dirección, etc.)
  container          container[]
  timetable          timetable[]
  created_at         DateTime     @default(now())
  updated_at         DateTime     @updatedAt
}

enum api_location {
  Navarra
  Barcelona
}
```

---

## Comportamiento de caché

1) Primera consulta (cold start)
- No existe caché → se crea metadata, se sincroniza (bloqueante), se inserta y se sirve.
- Respuesta aprox.: 15‑25s (solo la primera vez por zona).

2) Cache hit (caché fresca)
- `last_sync` dentro de TTL → SELECT y devolver en <100ms.

3) Caché stale (SWR)
- Caché expirada pero existente → devolver datos en <100ms y lanzar refresh en background (si no hay otro en curso).

Notas:
- Preferimos servir stale que bloquear al usuario.
- El scheduler refresca de forma proactiva para minimizar stale.

---

## Scheduler y warmup

- Cron por zona a partir de `RECYCLING_SOURCES[region].cron`.
- Evita solapamientos: si `status = SYNCING`, no inicia otra sync.
- Actualiza `cache_metadata` (status, last_sync, next_sync, total_records, error_message).
- Warmup: al arrancar, precarga TODAS las zonas en paralelo.
- Gating de entorno: warmup y cron SOLO en producción (`NODE_ENV=production`).

---

## Manejo de errores

- En cron: si falla, `status = ERROR`, `error_message` con detalle, se conservan datos previos. El siguiente cron reintenta.
- En cold start: si falla, devolver 503 con mensaje de indisponibilidad y registrar `ERROR`.
- Región no soportada: 404 con mensaje y lista de regiones válidas.

---

## Endpoints (resumen)

1) Obtener puntos (público)
```
GET /api/recycling-points/:region
```
Respuesta 200 OK:
```json
{
  "success": true,
  "totalRegisters": 1738,
  "data": [
    {
      "recycling_point_id": "uuid",
      "api_id": 123,
      "api_location": "Navarra",
      "lat": 42.0,
      "lng": -1.0,
      "active": true
    }
  ]
}
```

2) Estado de caché (admin)
```
GET /api/recycling-points/:region/status
```
Respuesta 200 OK:
```json
{
  "success": true,
  "data": {
    "source": "NAVARRA_POINTS",
    "status": "READY",
    "total_records": 1738,
    "minutes_since_sync": 25
  }
}
```

3) Forzar refresh (admin)
```
POST /api/recycling-points/:region/refresh
```
Respuesta 200 OK:
```json
{
  "success": true,
  "message": "Sincronización completada exitosamente.",
  "data": {
    "region": "navarra",
    "inserted": 5,
    "updated": 12,
    "deactivated": 2,
    "total_records": 1738,
    "sync_duration_ms": 19234
  }
}
```
Respuesta 409 (si ya hay sync en curso):
```json
{
  "success": false,
  "code": "SYNC_IN_PROGRESS"
}
```

> Documentación detallada en `docs/api/endpoints/`.

---

## Observabilidad y logs

- Logger con niveles: `error|warn|info|debug|trace` y filtros por namespace.
- Variables de entorno:
  - `LOG_LEVEL` (por defecto `info`)
  - `LOG_NAMESPACES` (lista separada por comas con comodín `*`)
- Namespaces típicos: `startup`, `scheduler`, `navarra-sync`, `cache`, `sync-job`, `recycling-points`, `route-service`, `auth`.
- Ver README → sección “Logging configurable (nivell i namespaces)”.

---

## Añadir una nueva zona (ejemplo)

1. Crear `src/services/<zona>-sync.service.js` con `sync<Zona>Points()` que devuelva el array normalizado de puntos.
2. Añadir entrada en `RECYCLING_SOURCES` con `source`, `apiLocation`, `syncFn`, `cron`, `ttl`, `syncInterval`.
3. Añadir valor al enum Prisma `api_location` y migrar.
4. Listo: se crean rutas y cron automáticamente.

---

## Métricas y SLAs

- <200ms con caché (P95) por endpoint público.
- >95% de éxito en cron por zona.
- Edad media de caché dentro del TTL de cada zona.
- Alertar si hay >3 fallos consecutivos en una zona o `status=ERROR` persistente.

---

## Notas

- TTL suele ser mayor que `syncInterval` para dar margen (p. ej., +30m).
- Offsets en cron reducen picos simultáneos entre zonas.
- En desarrollo no se ejecutan warmup ni cron (evita tráfico a APIs).
