// Cache Service: centralizes cache status, freshness checks and SWR (stale-while-revalidate)
// for external datasets (Navarra, Barcelona recycling points, etc.)

import { prisma } from '#lib/prisma.js';
import { RECYCLING_SOURCES } from '#config/recycling-sources.config.js';
import { createLogger } from '#lib/logger.js';

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
// - filters: object with extra where clauses (e.g. { api_id: 123, name: { contains: '...' } })
// Returns: { data, metadata, isStale, coldStart }
export async function getCachedPoints({ source, apiLocation, onRefresh, filters = {} } = {}) {
  if (!source || !apiLocation) {
    throw new Error('[cache] getCachedPoints requires source and apiLocation');
  }

  // 1) Ensure metadata exists and read it
  const meta = await ensureMetadata(source);
  const stale = isStale(meta.last_sync, source);

  // --- CONSTRUCCIÓN DINÁMICA DEL WHERE ---
  // Combina la ubicación, el estado activo y los filtros que vienen del controlador
  const whereClause = {
    api_location: apiLocation,
    active: true,
    ...filters,
  };

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
      schedule: true,
      last_updated: true,
      // raw_payload could be large; omit by default for list views.
    },
    orderBy: { api_id: 'asc' },
  });

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
            schedule: true,
            last_updated: true,
          },
          orderBy: { api_id: 'asc' },
        });

        return {
          data: refreshed,
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
    data: points,
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