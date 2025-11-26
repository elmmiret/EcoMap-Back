// Cache Service: centralizes cache status, freshness checks and SWR (stale-while-revalidate)
// for external datasets (Navarra, Barcelona recycling points, etc.)

import { prisma } from '#lib/prisma.js';
import { RECYCLING_SOURCES } from '#config/recycling-sources.config.js';
import { createLogger } from '#lib/logger.js';
import { filterByScheduleInMemory, getTimetablesForDay } from '#services/schedule-check.service.js';

const log = createLogger('cache');

// Export cache source constants (generated from config)
export const CACHE_SOURCES = Object.fromEntries(Object.values(RECYCLING_SOURCES).map((cfg) => [cfg.source, cfg.source]));

/**
 * Get cache policy for a source (TTL and sync interval)
 * @param {string} source - cache source identifier
 * @returns {{ ttl: number, syncInterval: number }}
 */
function getCachePolicy(source) {
  const config = Object.values(RECYCLING_SOURCES).find((cfg) => cfg.source === source);
  return {
    ttl: config?.ttl || 90 * 60 * 1000, // default 1h30m
    syncInterval: config?.syncInterval || 60 * 60 * 1000, // default 1h
  };
}

/**
 * Get sync interval for a source (for job scheduling)
 * @param {string} source - cache source identifier
 * @returns {number} sync interval in ms
 */
export function getSyncIntervalMs(source) {
  return getCachePolicy(source).syncInterval;
}

// Helper: compute if metadata indicates a stale cache
export function isStale(lastSync, source, now = new Date()) {
  if (!lastSync) return true; // never synced → stale
  const { ttl } = getCachePolicy(source);
  return now.getTime() - new Date(lastSync).getTime() > ttl;
}

// Ensure a metadata row exists for a source; return it
export async function ensureMetadata(source) {
  const existing = await prisma.cache_metadata.findUnique({ where: { source } });
  if (existing) return existing;
  const { syncInterval } = getCachePolicy(source);
  return prisma.cache_metadata.create({
    data: {
      source,
      status: 'READY',
      total_records: 0,
      last_sync: null,
      next_sync: new Date(Date.now() + syncInterval),
    },
  });
}

export async function getCacheStatus(source) {
  const meta = await ensureMetadata(source);
  const stale = isStale(meta.last_sync, source);
  return { ...meta, is_stale: stale };
}

export async function markStatus(source, status, patch = {}) {
  return prisma.cache_metadata.update({
    where: { source },
    data: {
      status,
      ...patch,
    },
  });
}

// Fire-and-forget background refresh with proper status transitions
async function triggerBackgroundRefresh({ source, refreshFn }) {
  // Double-check we have metadata
  await ensureMetadata(source);

  // Try to flip to SYNCING (best-effort; if another worker already did, this will throw)
  try {
    await markStatus(source, 'SYNCING');
  } catch {
    // If concurrent update fails, just bail out to avoid overlap
    return;
  }

  const startedAt = Date.now();
  const { syncInterval } = getCachePolicy(source);

  try {
    const result = await refreshFn();
    // Expect result to optionally include { totalRecords }
    const total = typeof result?.totalRecords === 'number' ? result.totalRecords : undefined;

    await markStatus(source, 'READY', {
      last_sync: new Date(),
      next_sync: new Date(Date.now() + syncInterval),
      ...(typeof total === 'number' ? { total_records: total } : {}),
      error_message: null,
    });
  } catch (err) {
    await markStatus(source, 'ERROR', {
      error_message: err?.message?.slice(0, 500) || 'Unknown error',
      // keep last_sync intact (per docs), schedule a next attempt anyway
      next_sync: new Date(Date.now() + syncInterval),
    });
  } finally {
    const duration = Date.now() - startedAt;
    log.info('background refresh finished', { source, duration_ms: duration });
  }
}

// Main SWR entrypoint: serve cached points for any location, trigger background refresh if stale.
// Options:
// - source: cache source key (e.g. 'NAVARRA_POINTS', 'BARCELONA_POINTS')
// - apiLocation: api_location value in DB (e.g. 'Navarra', 'Barcelona')
// - onRefresh: async function to perform the sync (required to refresh)
// - filters: object with all filter options (DB filters like name/equipment_type + schedule filters like isOpenNow/openAt)
// Returns: { data, metadata, isStale, coldStart }
export async function getCachedPoints({ source, apiLocation, onRefresh, filters = {} } = {}) {
  if (!source || !apiLocation) {
    throw new Error('[cache] getCachedPoints requires source and apiLocation');
  }

  // 1) Ensure metadata exists and read it
  const meta = await ensureMetadata(source);
  const stale = isStale(meta.last_sync, source);

  // --- SEPARAR FILTROS DE DB vs FILTROS POST-PROCESAMIENTO ---
  // Extraemos los filtros de horario (memoria), wasteType (relación), name (memoria) y proximidad (bounding box + Haversine)
  const { isOpenNow, openAt, wasteType, name, lat, lng, radius, ...dbFilters } = filters;

  // --- CONSTRUCCIÓN DINÁMICA DEL WHERE ---
  // Combina la ubicación, el estado activo y los filtros de DB
  const whereClause = {
    api_location: apiLocation,
    active: true,
    ...dbFilters,
  };

  // Si hay filtro por tipo de residuo, agregar filtro de relación container
  if (wasteType) {
    whereClause.container = {
      some: {
        type: wasteType, // Filtra puntos que tienen al menos un contenedor de este tipo
      },
    };
  }

  // Si hay filtro de proximidad, aplicar bounding box para optimizar query
  if (lat !== undefined && lng !== undefined && radius !== undefined) {
    const latDelta = radius / 111.32; // 1 grado lat ≈ 111.32 km
    const lngDelta = radius / (111.32 * Math.cos((lat * Math.PI) / 180)); // ajustado por latitud
    whereClause.latitude = {
      gte: lat - latDelta,
      lte: lat + latDelta,
    };
    whereClause.longitude = {
      gte: lng - lngDelta,
      lte: lng + lngDelta,
    };
  }

  // 2) Load cached data from DB
  if (!prisma?.recycling_point) {
    throw new Error("[cache] Prisma client desactualizado: falta el modelo 'recycling_point'. Ejecuta `npx prisma generate` y reinicia el servidor.");
  }
  const points = await prisma.recycling_point.findMany({
    where: whereClause, // <--- USAMOS LA CLÁUSULA DINÁMICA
    select: {
      recycling_point_id: true,
      api_id: true,
      name: true,
      latitude: true,
      longitude: true,
      equipment_type: true,
      last_updated: true,
      container: {
        select: {
          container_id: true,
          type: true,
          is_full: true,
          is_damaged: true,
        },
      },
      // raw_payload could be large; omit by default for list views.
    },
    orderBy: { api_id: 'asc' },
  });

  // --- APLICAR FILTRO DE PROXIMIDAD (Haversine exacto) ---
  let filteredPoints = points;
  if (lat !== undefined && lng !== undefined && radius !== undefined) {
    const R = 6371; // Radio de la Tierra en km
    filteredPoints = filteredPoints
      .map((p) => {
        if (!p.latitude || !p.longitude) return null;
        const dLat = ((p.latitude - lat) * Math.PI) / 180;
        const dLng = ((p.longitude - lng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((p.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance <= radius ? { ...p, distance_km: Math.round(distance * 100) / 100 } : null;
      })
      .filter((p) => p !== null)
      .sort((a, b) => a.distance_km - b.distance_km); // ordenar por distancia
    log.debug('Applied proximity filter (Haversine)', {
      lat,
      lng,
      radius,
      before: points.length,
      after: filteredPoints.length,
    });
  }

  // --- ENRIQUECER CON HORARIOS DEL DÍA ---
  // Determinar qué día usar: openAt si está presente, o día actual
  const targetDate = openAt ? new Date(openAt) : new Date();
  const pointIds = filteredPoints.map((p) => p.recycling_point_id).filter(Boolean);
  const timetablesMap = await getTimetablesForDay(pointIds, targetDate);

  // Añadir campo timetable a cada punto
  filteredPoints = filteredPoints.map((p) => ({
    ...p,
    timetable: timetablesMap.get(p.recycling_point_id) || [],
  }));
  log.debug('Enriched points with timetable data', {
    targetDay: targetDate.toDateString(),
    pointsWithTimetable: Array.from(timetablesMap.keys()).length,
  });

  // --- APLICAR FILTRO DE NOMBRE (accent-insensitive) ---
  if (name) {
    const normSearch = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    filteredPoints = filteredPoints.filter((p) => {
      if (!p.name) return false;
      const normName = p.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return normName.includes(normSearch);
    });
    log.debug('Applied name (accent-insensitive) filter', { search: name, before: points.length, after: filteredPoints.length });
  }

  // --- APLICAR FILTROS DE HORARIO (POST-PRISMA) ---
  // Los filtros de schedule se aplican en memoria porque el horario está normalizado en tablas auxiliares
  // IMPORTANTE: Usar filterByScheduleInMemory porque ya tenemos el campo timetable enriquecido
  if (isOpenNow) {
    // Filter points that are open right now
    filteredPoints = filterByScheduleInMemory(filteredPoints, new Date());
    log.debug('Applied isOpenNow filter', { before: points.length, after: filteredPoints.length });
  } else if (openAt) {
    // Filter points that are open at a specific datetime
    const targetDate = new Date(openAt);
    if (!isNaN(targetDate.getTime())) {
      filteredPoints = filterByScheduleInMemory(filteredPoints, targetDate);
      log.debug('Applied openAt filter', { openAt, before: points.length, after: filteredPoints.length });
    } else {
      log.warn('Invalid openAt date provided', { openAt });
    }
  }

  // Nota: coldStart ahora depende de si NUNCA se ha sincronizado.
  // Si hay filtros, points.length puede ser 0 aunque haya datos en cache.
  // Con !meta.last_sync nos aseguramos de que sea un verdadero cold start.
  const coldStart = !meta.last_sync;

  // 3) Decide whether to trigger a background refresh (SWR)
  if (stale && typeof onRefresh === 'function' && meta.status !== 'SYNCING') {
    // Fire-and-forget; don't await
    triggerBackgroundRefresh({ source, refreshFn: onRefresh }).catch((e) => console.error('[cache] refresh error (unhandled):', e));
  }

  // 4) Return behavior
  if (coldStart) {
    // Cold start: si hay función de refresh, realizar un refresh BLOQUEANTE aquí mismo
    if (typeof onRefresh === 'function') {
      try {
        // Intentar marcar estado SYNCING (best-effort)
        try {
          await markStatus(source, 'SYNCING');
        } catch {
          /* ignore concurrent update error */
        }

        const startedAt = Date.now();
        const result = await onRefresh();
        const total = typeof result?.totalRecords === 'number' ? result.totalRecords : undefined;

        const { syncInterval } = getCachePolicy(source);
        await markStatus(source, 'READY', {
          last_sync: new Date(),
          next_sync: new Date(Date.now() + syncInterval),
          ...(typeof total === 'number' ? { total_records: total } : {}),
          error_message: null,
        });

        // Releer puntos tras el refresh (USANDO LOS MISMOS FILTROS)
        const refreshed = await prisma.recycling_point.findMany({
          where: whereClause, // <--- IMPORTANTE: MANTENER FILTROS
          select: {
            recycling_point_id: true,
            api_id: true,
            name: true,
            latitude: true,
            longitude: true,
            equipment_type: true,
            last_updated: true,
            container: {
              select: {
                container_id: true,
                type: true,
                is_full: true,
                is_damaged: true,
              },
            },
          },
          orderBy: { api_id: 'asc' },
        });

        // Enriquecer con horarios del día
        const targetDateRefresh = openAt ? new Date(openAt) : new Date();
        const refreshedIds = refreshed.map((p) => p.recycling_point_id).filter(Boolean);
        const timetablesMapRefresh = await getTimetablesForDay(refreshedIds, targetDateRefresh);
        let filteredRefreshed = refreshed.map((p) => ({
          ...p,
          timetable: timetablesMapRefresh.get(p.recycling_point_id) || [],
        }));

        // Aplicar filtros de horario también después del refresh
        // IMPORTANTE: Usar filterByScheduleInMemory porque ya enriquecimos con timetable
        if (isOpenNow) {
          filteredRefreshed = filterByScheduleInMemory(filteredRefreshed, new Date());
        } else if (openAt) {
          const targetDate = new Date(openAt);
          if (!isNaN(targetDate.getTime())) {
            filteredRefreshed = filterByScheduleInMemory(filteredRefreshed, targetDate);
          }
        }

        return {
          data: filteredRefreshed,
          metadata: { ...(await ensureMetadata(source)), is_stale: false },
          isStale: false,
          coldStart: false,
          refreshDurationMs: Date.now() - startedAt,
        };
      } catch (err) {
        // Si el refresh falla, devolver vacío e indicar coldStart (el controlador puede decidir qué hacer)
        console.error('[cache] blocking refresh failed on cold start:', err?.message || err);
        return {
          data: [],
          metadata: { ...meta, is_stale: true },
          isStale: true,
          coldStart: true,
        };
      }
    }

    // No hay función de refresh: devolver vacío indicando coldStart
    return {
      data: [],
      metadata: { ...meta, is_stale: true },
      isStale: true,
      coldStart: true,
    };
  }

  // Serve cached data immediately (even if stale), SWR will refresh in background
  return {
    data: filteredPoints,
    metadata: { ...meta, is_stale: stale },
    isStale: stale,
    coldStart: false,
  };
}

// Backward compatibility wrapper for Navarra
export async function getNavarraPoints({ onRefresh } = {}) {
  return getCachedPoints({
    source: CACHE_SOURCES.NAVARRA_POINTS,
    apiLocation: 'Navarra',
    onRefresh,
  });
}

// Utility to compute minutes since last sync (for status endpoint)
export function minutesSince(date) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 60000);
}
