/**
 * Navarra Sync Service
 *
 * Sincroniza los puntos de reciclaje de Navarra desde la API pública
 * hacia la base de datos PostgreSQL.
 */

import { prisma } from '#lib/prisma.js';
import { createLogger } from '#lib/logger.js';

const log = createLogger('navarra-sync');

// Configuración de la API de Navarra (a través del proxy de Cloudflare)
const NAVARRA_PROXY_BASE = process.env.NAVARRA_PROXY_BASE;
const NAVARRA_RESOURCE_ID = process.env.NAVARRA_RESOURCE_ID;
const FETCH_TIMEOUT_MS = Number(process.env.NAVARRA_FETCH_TIMEOUT_MS || 25000);
const WORKER_TIMEOUT_MS = Number(process.env.NAVARRA_WORKER_TIMEOUT_MS || 20000);

/**
 * Construye la URL para consultar la API de Navarra a través del Worker
 * @param {string} targetUrl - URL destino de la API de Navarra
 * @returns {string} URL del Worker con los parámetros necesarios
 */
function viaWorker(targetUrl) {
  return `${NAVARRA_PROXY_BASE}?url=${encodeURIComponent(targetUrl)}&timeout_ms=${WORKER_TIMEOUT_MS}`;
}

/**
 * Parsea un punto de reciclaje de Navarra desde el formato de la API
 * al formato de nuestra base de datos.
 *
 * Estructura de la API:
 * - _id: ID del registro
 * - "ID Equipamiento": ID único del punto
 * - TipoEquipamiento: Tipo de residuo (Pilas, Vidrio, etc.)
 * - x: Latitud
 * - y: Longitud
 * - Localidad: Nombre del punto/ubicación
 * - Direccion: Dirección completa
 * - Horario: Horario de apertura
 * - "Fecha ultima actualizacion": Timestamp de última modificación
 *
 * @param {Object} rawPoint - Punto de reciclaje tal como viene de la API
 * @returns {Object} Punto parseado listo para insertar/actualizar
 */
function parseNavarraPoint(rawPoint) {
  // Parsear fecha de actualización (formato: "26/10/2022 10:00:46" o "26/10/2022 9:00:46")
  let lastUpdated = null;
  if (rawPoint['Fecha ultima actualizacion']) {
    try {
      const [datePart, timePart] = rawPoint['Fecha ultima actualizacion'].trim().split(' ');
      if (datePart && timePart) {
        const [day, month, year] = datePart.split('/');
        // Normalizar la hora para asegurar formato HH:MM:SS (añadir cero inicial si falta)
        const [hours, minutes, seconds] = timePart.split(':');
        const normalizedTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
        const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${normalizedTime}`;
        lastUpdated = new Date(isoString);

        // Validar que la fecha parseada sea válida
        if (isNaN(lastUpdated.getTime())) {
          console.warn(`[NAVARRA-SYNC] Invalid date parsed for point ${rawPoint._id}: "${rawPoint['Fecha ultima actualizacion']}"`);
          lastUpdated = null;
        }
      }
    } catch (error) {
      console.warn(`[NAVARRA-SYNC] Failed to parse date for point ${rawPoint._id}: "${rawPoint['Fecha ultima actualizacion']}" - ${error.message}`);
      lastUpdated = null;
    }
  }

  return {
    api_id: rawPoint._id,
    api_location: 'Navarra',
    name: rawPoint.Localidad || rawPoint.Direccion || 'Sin nombre',
    latitude: rawPoint.x ? parseFloat(rawPoint.x) : null,
    longitude: rawPoint.y ? parseFloat(rawPoint.y) : null,
    equipment_type: rawPoint.TipoEquipamiento || null,
    schedule: rawPoint.Horario || null,
    last_updated: lastUpdated,
    raw_payload: rawPoint, // Guardamos el JSON completo
    active: true,
  };
}

/**
 * Consulta la API de Navarra y obtiene todos los puntos de reciclaje.
 * Usa paginación para obtener todos los registros.
 *
 * @returns {Promise<Array>} Array de puntos de reciclaje parseados
 * @throws {Error} Si falla la consulta a la API
 */
export async function fetchNavarraPoints() {
  try {
    log.info('Fetching points from API...');
    const startTime = Date.now();

    // Validación de configuración
    if (!NAVARRA_PROXY_BASE) {
      throw new Error('NAVARRA_PROXY_BASE no está definida en el entorno');
    }
    if (!NAVARRA_RESOURCE_ID) {
      throw new Error('NAVARRA_RESOURCE_ID no está definida en el entorno');
    }

    const baseUrl = 'https://datosabiertos.navarra.es/es/api/3/action/datastore_search';
    const limit = 1000;
    let offset = 0;
    let allRecords = [];
    let hasMore = true;

    // Paginación: obtener todos los registros
    while (hasMore) {
      const targetUrl = `${baseUrl}?resource_id=${NAVARRA_RESOURCE_ID}&limit=${limit}&offset=${offset}`;
      const proxyUrl = viaWorker(targetUrl);

      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'PESkaos-Backend/1.0',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();

      // Soportar múltiples formatos de respuesta (CKAN estándar y variantes):
      // - CKAN típico: { success: true, result: { records: [...] } }
      // - Variante previa: { success: true, data: [...] }
      // - Fallbacks: { records: [...] } o array directo
      let records = null;
      if (Array.isArray(data?.data)) {
        records = data.data;
      } else if (Array.isArray(data?.result?.records)) {
        records = data.result.records;
      } else if (Array.isArray(data?.records)) {
        records = data.records;
      } else if (Array.isArray(data)) {
        records = data;
      }

      if (!Array.isArray(records)) {
        const keys = data && typeof data === 'object' ? Object.keys(data).slice(0, 6).join(', ') : typeof data;
        throw new Error(`Invalid API response format (top-level keys: ${keys || 'n/a'})`);
      }
      allRecords = allRecords.concat(records);

      log.debug(`Fetched ${records.length} records (offset ${offset}, total so far: ${allRecords.length})`);

      // Verificar si hay más registros
      hasMore = records.length === limit;
      offset += limit;
    }

    const duration = Date.now() - startTime;
    log.info(`API responded in ${(duration / 1000).toFixed(1)}s with ${allRecords.length} total points`);

    return allRecords.map(parseNavarraPoint);
  } catch (error) {
    log.error('Error fetching from API:', error.message);
    throw new Error(`Failed to fetch Navarra points: ${error.message}`);
  }
}

/**
 * Sincroniza los puntos de Navarra con la base de datos.
 *
 * Estrategia:
 * 1. Obtener puntos actuales de la API
 * 2. Para cada punto de la API:
 *    - Si existe en BD (mismo api_id + api_location): UPDATE
 *    - Si no existe: INSERT
 * 3. Puntos en BD que no están en API: marcar active = false
 *
 * @returns {Promise<Object>} Estadísticas de la sincronización
 * @throws {Error} Si falla la sincronización
 */
export async function syncNavarraPoints() {
  const startTime = Date.now();
  const stats = {
    inserted: 0,
    updated: 0,
    deactivated: 0,
    totalRecords: 0,
    errors: 0,
    duration: 0,
  };

  try {
    // 1. Obtener puntos de la API
    const apiPoints = await fetchNavarraPoints();
    log.info(`Processing ${apiPoints.length} points from API`);

    // Verificar duplicados de api_id en los datos de la API
    const apiIdCounts = new Map();
    apiPoints.forEach((p) => {
      apiIdCounts.set(p.api_id, (apiIdCounts.get(p.api_id) || 0) + 1);
    });
    const duplicates = Array.from(apiIdCounts.entries()).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      log.warn(
        `Found ${duplicates.length} duplicate api_id values in API data:`,
        duplicates.slice(0, 5).map(([id, count]) => `${id} (x${count})`)
      );
    }

    // Cargar IDs existentes ANTES del upsert para distinguir insert vs update
    const existingRows = await prisma.recycling_point.findMany({
      where: { api_location: 'Navarra' },
      select: { api_id: true },
    });
    const existingIds = new Set(existingRows.map((r) => r.api_id));

    // Crear un Set de IDs reportados por la API para detectar puntos eliminados
    const apiIds = new Set(apiPoints.map((p) => p.api_id));
    log.debug(`Unique api_id values in API response: ${apiIds.size} (total points: ${apiPoints.length})`);

    // 2. Upsert de cada punto
    const errorDetails = [];
    for (const point of apiPoints) {
      try {
        // Upsert: si existe (por unique constraint), actualiza; si no, inserta
        const existed = existingIds.has(point.api_id);
        await prisma.recycling_point.upsert({
          where: {
            api_location_api_id: {
              api_location: 'Navarra',
              api_id: point.api_id,
            },
          },
          update: {
            name: point.name,
            latitude: point.latitude,
            longitude: point.longitude,
            equipment_type: point.equipment_type,
            schedule: point.schedule,
            last_updated: point.last_updated,
            raw_payload: point.raw_payload,
            active: true, // Reactivar si estaba inactivo
            updated_at: new Date(),
          },
          create: point,
        });

        // Actualizar métricas según existencia previa
        if (existed) {
          stats.updated++;
        } else {
          stats.inserted++;
          existingIds.add(point.api_id);
        }
      } catch (error) {
        log.warn(`Error upserting point ${point.api_id}:`, error.message);
        stats.errors++;
        // Guardar los primeros 10 errores para logging detallado
        if (errorDetails.length < 10) {
          errorDetails.push({
            api_id: point.api_id,
            name: point.name,
            error: error.message,
            code: error.code,
          });
        }
      }
    }

    // Log detallado de errores si hubo
    if (stats.errors > 0) {
      log.warn(`Total errors during upsert: ${stats.errors}`);
      log.debug(`Sample error details: ${JSON.stringify(errorDetails, null, 2)}`);
    }

    // 3. Desactivar puntos que ya no están en la API
    const deactivateResult = await prisma.recycling_point.updateMany({
      where: {
        api_location: 'Navarra',
        api_id: {
          notIn: Array.from(apiIds),
        },
        active: true, // Solo desactivar los que están activos
      },
      data: {
        active: false,
        updated_at: new Date(),
      },
    });

    stats.deactivated = deactivateResult.count;

    // 4. Contar total de puntos activos
    const totalActive = await prisma.recycling_point.count({
      where: {
        api_location: 'Navarra',
        active: true,
      },
    });

    stats.totalRecords = totalActive;
    stats.duration = Date.now() - startTime;

    // Las métricas inserted/updated ya fueron calculadas durante el upsert

    log.info(
      `Sync completed: ` +
        `${apiPoints.length} from API → ` +
        `+${stats.inserted} inserted, ` +
        `${stats.updated} updated, ` +
        `-${stats.deactivated} deactivated, ` +
        `${stats.errors} errors, ` +
        `${stats.totalRecords} total active ` +
        `in ${(stats.duration / 1000).toFixed(1)}s`
    );

    // Advertencia si hay discrepancia
    const expectedActive = apiPoints.length - stats.errors;
    if (stats.totalRecords !== expectedActive && stats.errors === 0) {
      log.warn(
        `Discrepancy detected! ` +
          `Expected ${expectedActive} active points (${apiPoints.length} from API - ${stats.errors} errors), ` +
          `but DB reports ${stats.totalRecords} active. Possible duplicate api_id values in API data.`
      );
    }

    return stats;
  } catch (error) {
    stats.duration = Date.now() - startTime;
    log.error('Sync failed:', error.message);
    throw error;
  }
}

export { parseNavarraPoint };
