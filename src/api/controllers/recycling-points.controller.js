import { getCachedPoints, getCacheStatus, minutesSince } from '#services/cache.service.js';
import { getSourceConfig, isLocationSupported } from '#config/recycling-sources.config.js';
import { runSyncJob } from '#jobs/sync-points.job.js';
import { createLogger } from '#lib/logger.js';

const log = createLogger('recycling-points');

// GET /api/recycling-points/:region
// Returns recycling points for the given region (navarra, barcelona, etc.)
export async function getRecyclingPointsByRegion(req, res) {
  const startTime = Date.now();
  const { region } = req.params;
  const requestId = `${region}-${Date.now()}`;

  // --- INICIO MODIFICACIÓN FILTROS ---
  // Extraemos los filtros de la query string
  const { api_id, equipment_type, wasteType, name, isOpenNow, openAt, lat, lng, radius } = req.query;
  const filters = {};

  // 1. Filtro por ID (Entero exacto)
  if (api_id) {
    const parsedId = parseInt(api_id, 10);
    if (!isNaN(parsedId)) {
      filters.api_id = parsedId;
    }
  }

  // 2. Filtro por Tipo de Punto (equipment_type: Deixalleria, Punt Verd, etc.)
  if (equipment_type) {
    filters.equipment_type = equipment_type;
  }

  // 3. Filtro por Tipo de Residuo (wasteType: Glass, Paper, Plastic, etc.)
  // Este filtro busca en la relación container -> product_type
  if (wasteType) {
    filters.wasteType = wasteType; // product_type enum value
  }

  // 4. Filtro por Nombre (accent-insensitive en memoria más adelante)
  if (name) {
    filters.name = name; // pasamos el término bruto; se normaliza en cache.service
  }

  // 5. Filtro por Proximidad (lat, lng, radius en km)
  if (lat && lng && radius) {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedRadius = parseFloat(radius);
    if (!isNaN(parsedLat) && !isNaN(parsedLng) && !isNaN(parsedRadius) && parsedRadius > 0) {
      filters.lat = parsedLat;
      filters.lng = parsedLng;
      filters.radius = parsedRadius;
    }
  }

  // 6. Filtro por Horario: "¿Está abierto ahora?"
  if (isOpenNow === 'true' || isOpenNow === '1') {
    filters.isOpenNow = true;
  }

  // 7. Filtro por Horario: "¿Está abierto en fecha/hora específica?"
  if (openAt) {
    filters.openAt = openAt; // ISO 8601 datetime string
  }
  // --- FIN MODIFICACIÓN FILTROS ---

  log.info(`[${requestId}] Request iniciado:`, {
    timestamp: new Date().toISOString(),
    region,
    query: req.query,
    appliedFilters: filters, // Logueamos todos los filtros aplicados
  });

  // Validate region/location
  if (!isLocationSupported(region)) {
    log.warn(`[${requestId}] Región no soportada:`, {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - startTime}ms`,
      statusCode: 404,
      region,
    });

    return res.status(404).json({
      success: false,
      message: `Región no encontrada: ${region}`,
      code: 'REGION_NOT_FOUND',
    });
  }

  const config = getSourceConfig(region);
  const { source, apiLocation, syncFn } = config;

  try {
    log.debug(`[${requestId}] Obteniendo puntos desde cache:`, {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - startTime}ms`,
      source,
      apiLocation,
    });

    const result = await getCachedPoints({
      source,
      apiLocation,
      onRefresh: syncFn,
      filters, // <--- Pasamos todos los filtros al servicio
    });

    // Cold start: no cache available yet
    if (result.coldStart) {
      log.info(`[${requestId}] Cache vacía, sincronizando...`, {
        timestamp: new Date().toISOString(),
        elapsed: `${Date.now() - startTime}ms`,
      });

      try {
        await syncFn();
        // Re-fetch after sync (usando los mismos filtros)
        const afterSync = await getCachedPoints({
          source,
          apiLocation,
          onRefresh: syncFn,
          filters, // <--- Pasamos todos los filtros también aquí
        });

        log.info(`[${requestId}] Cold start sync completado:`, {
          timestamp: new Date().toISOString(),
          elapsed: `${Date.now() - startTime}ms`,
          recordsCount: afterSync.data.length,
          statusCode: 200,
        });

        return res.status(200).json({
          success: true,
          message: `Puntos de reciclaje encontrados en ${apiLocation}`,
          totalRegisters: afterSync.data.length,
          data: afterSync.data,
        });
      } catch (syncErr) {
        log.error(`[${requestId}] Cold start sync failed:`, {
          timestamp: new Date().toISOString(),
          elapsed: `${Date.now() - startTime}ms`,
          error: syncErr.message,
        });

        return res.status(503).json({
          success: false,
          message: 'Cache vacía y sincronización inicial falló. Intente más tarde.',
          code: 'SERVICE_UNAVAILABLE',
        });
      }
    }

    // Normal case: serve cached data (even if stale, SWR will refresh in background)
    log.info(`[${requestId}] Respuesta desde cache:`, {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - startTime}ms`,
      recordsCount: result.data.length,
      isStale: result.isStale,
      statusCode: 200,
    });

    return res.status(200).json({
      success: true,
      message: `Puntos de reciclaje encontrados en ${apiLocation}`,
      totalRegisters: result.data.length,
      data: result.data,
    });
  } catch (error) {
    log.error(`[${requestId}] Error al obtener puntos:`, {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - startTime}ms`,
      errorCode: error.code,
      errorMessage: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      message: 'Error al consultar los puntos de reciclaje',
      code: 'RECYCLING_POINTS_ERROR',
    });
  }
}

// GET /api/recycling-points/:region/status
// Returns cache metadata and status for the given region
export async function getStatusByRegion(req, res) {
  const { region } = req.params;

  // Validate region
  if (!isLocationSupported(region)) {
    return res.status(404).json({
      success: false,
      message: `Región no encontrada: ${region}`,
      code: 'REGION_NOT_FOUND',
    });
  }

  const config = getSourceConfig(region);
  const { source, apiLocation } = config;

  try {
    const status = await getCacheStatus(source);

    return res.status(200).json({
      success: true,
      region,
      apiLocation,
      source,
      status: status.status,
      last_sync: status.last_sync,
      next_sync: status.next_sync,
      total_records: status.total_records,
      is_stale: status.is_stale,
      minutes_since_sync: status.last_sync ? minutesSince(status.last_sync) : null,
      error_message: status.error_message,
    });
  } catch (error) {
    console.error('[controller] error fetching status:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al consultar el estado del cache',
      code: 'CACHE_STATUS_ERROR',
    });
  }
}

// POST /api/recycling-points/:region/refresh
// Force immediate sync for the given region (admin endpoint)
export async function forceRefreshByRegion(req, res) {
  const { region } = req.params;

  // Validate region
  if (!isLocationSupported(region)) {
    return res.status(404).json({
      success: false,
      message: `Región no encontrada: ${region}`,
      code: 'REGION_NOT_FOUND',
    });
  }

  const config = getSourceConfig(region);
  const { source, syncFn, apiLocation } = config;

  try {
    const result = await runSyncJob({ source, syncFn });

    if (result.skipped) {
      return res.status(409).json({
        success: false,
        message: result.reason,
        code: 'SYNC_IN_PROGRESS',
      });
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Sync job failed',
        code: 'SYNC_FAILED',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Sincronización de ${apiLocation} completada`,
      region,
      inserted: result.inserted,
      updated: result.updated,
      deactivated: result.deactivated,
      total_records: result.totalRecords,
      sync_duration_ms: result.syncDurationMs,
    });
  } catch (error) {
    console.error('[controller] error forcing refresh:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al forzar sincronización',
      code: 'REFRESH_ERROR',
    });
  }
}

// POST /api/recycling-points/:region/reset
// Reset cache status to ERROR to unlock stuck SYNCING state (admin endpoint)
export async function resetCacheByRegion(req, res) {
  const { region } = req.params;

  // Validate region
  if (!isLocationSupported(region)) {
    return res.status(404).json({
      success: false,
      message: `Región no encontrada: ${region}`,
      code: 'REGION_NOT_FOUND',
    });
  }

  const config = getSourceConfig(region);
  const { source } = config;

  try {
    // Import markStatus from cache service
    const { markStatus } = await import('#services/cache.service.js');

    // Reset status to ERROR to unlock
    await markStatus(source, 'ERROR', {
      error_message: 'Cache reset manually by admin',
    });

    return res.status(200).json({
      success: true,
      message: `Estado de caché de ${region} reiniciado a ERROR`,
      region,
      source,
    });
  } catch (error) {
    console.error('[controller] error resetting cache:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al reiniciar la caché',
      code: 'CACHE_RESET_ERROR',
    });
  }
}
