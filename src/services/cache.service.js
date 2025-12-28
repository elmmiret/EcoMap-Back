// Cache Service: centralizes cache status, freshness checks and SWR
// + Generic in-memory cache for API responses

import { prisma } from '#lib/prisma.js';
import { RECYCLING_SOURCES } from '#config/recycling-sources.config.js';
import { createLogger } from '#lib/logger.js';
import { filterByScheduleInMemory, getTimetablesForDay } from '#services/schedule-check.service.js';

const log = createLogger('cache');

// Export cache source constants
export const CACHE_SOURCES = Object.fromEntries(Object.values(RECYCLING_SOURCES).map((cfg) => [cfg.source, cfg.source]));

/**
 * Get cache policy for a source (TTL and sync interval)
 */
function getCachePolicy(source) {
  const config = Object.values(RECYCLING_SOURCES).find((cfg) => cfg.source === source);
  return {
    ttl: config?.ttl || 25 * 60 * 60 * 1000, // default 25h
    syncInterval: config?.syncInterval || 24 * 60 * 60 * 1000, // default 24h
  };
}

export function getSyncIntervalMs(source) {
  return getCachePolicy(source).syncInterval;
}

export function isStale(lastSync, source, now = new Date()) {
  if (!lastSync) return true;
  const { ttl } = getCachePolicy(source);
  return now.getTime() - new Date(lastSync).getTime() > ttl;
}

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

// Fire-and-forget background refresh
async function triggerBackgroundRefresh({ source, refreshFn }) {
  await ensureMetadata(source);
  try {
    await markStatus(source, 'SYNCING');
  } catch {
    return;
  }

  const startedAt = Date.now();
  const { syncInterval } = getCachePolicy(source);

  try {
    const result = await refreshFn();
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
      next_sync: new Date(Date.now() + syncInterval),
    });
  } finally {
    const duration = Date.now() - startedAt;
    log.info('background refresh finished', { source, duration_ms: duration });
  }
}

/**
 * Función interna para centralizar la obtención y filtrado de puntos.
 */
async function fetchAndProcessPoints(whereClause, filters) {
  const { lat, lng, radius, name, isOpenNow, openAt } = filters;

  const points = await prisma.recycling_point.findMany({
    where: whereClause,
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

  let filteredPoints = points;

  // Filtro de Proximidad (Haversine)
  if (lat !== undefined && lng !== undefined && radius !== undefined) {
    const R = 6371; 
    filteredPoints = filteredPoints
      .map((p) => {
        if (!p.latitude || !p.longitude) return null;
        const dLat = ((p.latitude - lat) * Math.PI) / 180;
        const dLng = ((p.longitude - lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat * Math.PI) / 180) * Math.cos((p.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance <= radius ? { ...p, distance_km: Math.round(distance * 100) / 100 } : null;
      })
      .filter((p) => p !== null)
      .sort((a, b) => a.distance_km - b.distance_km);
  }

  // Enriquecer con Horarios
  const targetDate = openAt ? new Date(openAt) : new Date();
  const pointIds = filteredPoints.map((p) => p.recycling_point_id).filter(Boolean);
  const timetablesMap = await getTimetablesForDay(pointIds, targetDate);

  filteredPoints = filteredPoints.map((p) => ({
    ...p,
    timetable: timetablesMap.get(p.recycling_point_id) || [],
  }));

  // Filtro de Nombre
  if (name) {
    const normSearch = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    filteredPoints = filteredPoints.filter((p) => {
      if (!p.name) return false;
      const normName = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normName.includes(normSearch);
    });
  }

  // Filtro de Horario
  if (isOpenNow) {
    filteredPoints = filterByScheduleInMemory(filteredPoints, new Date());
  } else if (openAt) {
    const targetDateObj = new Date(openAt);
    if (!isNaN(targetDateObj.getTime())) {
      filteredPoints = filterByScheduleInMemory(filteredPoints, targetDateObj);
    }
  }

  return filteredPoints;
}

// Main SWR entrypoint
export async function getCachedPoints({ source, apiLocation, onRefresh, filters = {} } = {}) {
  if (!source || !apiLocation) throw new Error('[cache] getCachedPoints requires source and apiLocation');

  const meta = await ensureMetadata(source);
  const stale = isStale(meta.last_sync, source);

  const { isOpenNow, openAt, wasteType, name, lat, lng, radius, ...dbFilters } = filters;

  const whereClause = {
    api_location: apiLocation,
    active: true,
    ...dbFilters,
  };

  if (wasteType) {
    whereClause.container = { some: { type: wasteType } };
  }

  if (lat !== undefined && lng !== undefined && radius !== undefined) {
    const latDelta = radius / 111.32;
    const lngDelta = radius / (111.32 * Math.cos((lat * Math.PI) / 180));
    whereClause.latitude = { gte: lat - latDelta, lte: lat + latDelta };
    whereClause.longitude = { gte: lng - lngDelta, lte: lng + lngDelta };
  }

  if (!prisma?.recycling_point) throw new Error("[cache] Prisma client desactualizado.");

  const coldStart = !meta.last_sync;

  if (coldStart) {
    if (typeof onRefresh === 'function') {
      try {
        try { await markStatus(source, 'SYNCING'); } catch {} 

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

        const data = await fetchAndProcessPoints(whereClause, filters);

        return {
          data,
          metadata: { ...(await ensureMetadata(source)), is_stale: false },
          isStale: false,
          coldStart: false,
          refreshDurationMs: Date.now() - startedAt,
        };
      } catch (err) {
        console.error('[cache] blocking refresh failed on cold start:', err?.message || err);
        return { data: [], metadata: { ...meta, is_stale: true }, isStale: true, coldStart: true };
      }
    }
    return { data: [], metadata: { ...meta, is_stale: true }, isStale: true, coldStart: true };
  }

  const data = await fetchAndProcessPoints(whereClause, filters);

  if (stale && typeof onRefresh === 'function' && meta.status !== 'SYNCING') {
    triggerBackgroundRefresh({ source, refreshFn: onRefresh }).catch((e) => console.error('[cache] refresh error:', e));
  }

  return {
    data,
    metadata: { ...meta, is_stale: stale },
    isStale: stale,
    coldStart: false,
  };
}

export async function getNavarraPoints({ onRefresh } = {}) {
  return getCachedPoints({
    source: CACHE_SOURCES.NAVARRA_POINTS,
    apiLocation: 'Navarra',
    onRefresh,
  });
}

export function minutesSince(date) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 60000);
}

// --------------------------------------------------------------------------
// GENERIC MEMORY CACHE (Para endpoints como getAllTrades)
// Implementación simple en memoria (Map) para evitar consultas repetitivas.
// --------------------------------------------------------------------------

const memoryCache = new Map();

/**
 * Obtiene un valor de la caché en memoria.
 * @param {string} key 
 * @returns {Promise<any | null>}
 */
export async function getCache(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  // Si ha expirado, borrar y devolver null
  if (Date.now() > entry.expiry) {
    memoryCache.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * Guarda un valor en la caché en memoria.
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds Tiempo de vida en segundos
 */
export async function setCache(key, value, ttlSeconds = 300) {
  const expiry = Date.now() + (ttlSeconds * 1000);
  memoryCache.set(key, { value, expiry });
  
  // Limpieza básica preventiva (opcional): si crece mucho, vaciar
  if (memoryCache.size > 1000) {
    memoryCache.clear();
  }
}