/**
 * Barcelona Sync Service
 *
 * Sincroniza los puntos de reciclaje de Barcelona desde la API pública (CKAN)
 * hacia la base de datos PostgreSQL.
 */

import { prisma } from '#lib/prisma.js';
import { createLogger } from '#lib/logger.js';

const log = createLogger('barcelona-sync');

const BARCELONA_RESOURCE_ID = process.env.BARCELONA_RESOURCE_ID;
const FETCH_TIMEOUT_MS = Number(process.env.BARCELONA_FETCH_TIMEOUT_MS || 20000);

/**
 * Normaliza un punto de la API de Barcelona al formato de nuestra BD.
 *
 * Estructura esperada del JSON de Barcelona:
 * - _id: ID del registro
 * - name: Nombre del punto
 * - geo_epgs_4326_lat / geo_epgs_4326_lon: Coordenadas en WGS84
 * - addresses_*: Campos de dirección
 * - secondary_filters_name: Tipo de equipamiento (ej: "Punts verds de zona")
 * - timetable: Horario
 * - modified: Fecha de última modificación
 */
function parseBarcelonaPoint(raw) {
  // Latitud y longitud desde campos estándar de Barcelona (EPSG 4326 = WGS84)
  const latitude = raw?.geo_epgs_4326_lat ? parseFloat(raw.geo_epgs_4326_lat) : null;
  const longitude = raw?.geo_epgs_4326_lon ? parseFloat(raw.geo_epgs_4326_lon) : null;

  // Nombre del punto
  const name = raw?.name || 'Sense nom';

  // Construir dirección completa desde los campos addresses_*
  let fullAddress = '';
  if (raw?.addresses_road_name) {
    fullAddress = raw.addresses_road_name;
    if (raw?.addresses_start_street_number) {
      fullAddress += `, ${raw.addresses_start_street_number}`;
    }
    if (raw?.addresses_neighborhood_name) {
      fullAddress += ` (${raw.addresses_neighborhood_name})`;
    }
  }

  // Tipo de equipamiento desde secondary_filters_name
  const equipmentType = raw?.secondary_filters_name || null;

  // Horario
  const schedule = raw?.timetable || null;

  // Última actualización desde campo "modified"
  let lastUpdated = null;
  if (raw?.modified) {
    const d = new Date(raw.modified);
    if (!isNaN(d.getTime())) {
      lastUpdated = d;
    }
  }

  // api_id desde _id
  const apiId = raw?._id;

  return {
    api_id: apiId,
    api_location: 'Barcelona',
    name: String(name),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    equipment_type: equipmentType ? String(equipmentType) : null,
    schedule: schedule ? String(schedule) : null,
    last_updated: lastUpdated,
    raw_payload: {
      ...raw,
      // Incluir dirección completa construida para facilitar búsquedas
      _computed_full_address: fullAddress || null,
    },
    active: true,
  };
}

/**
 * Descarga todos los registros del CKAN de Barcelona con paginación.
 */
export async function fetchBarcelonaPoints() {
  if (!BARCELONA_RESOURCE_ID) {
    throw new Error('BARCELONA_RESOURCE_ID no está definida en el entorno');
  }

  const baseUrl = 'https://opendata-ajuntament.barcelona.cat/data/api/3/action/datastore_search';
  const limit = 1000;
  let offset = 0;
  let all = [];

  try {
    log.info('Fetching points from Barcelona CKAN...');
    while (true) {
      const url = `${baseUrl}?resource_id=${BARCELONA_RESOURCE_ID}&limit=${limit}&offset=${offset}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'PESkaos-Backend/1.0' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`Barcelona API returned ${res.status}`);
      }
      const data = await res.json();
      const records = data?.result?.records;
      if (!Array.isArray(records)) {
        throw new Error('Formato inesperado en respuesta de Barcelona (result.records ausente)');
      }
      all = all.concat(records);
      log.debug(`Fetched ${records.length} records (offset ${offset}, total so far ${all.length})`);
      if (records.length < limit) break;
      offset += limit;
    }
    log.info(`Barcelona CKAN responded with ${all.length} raw records`);
    return all.map(parseBarcelonaPoint);
  } catch (err) {
    log.error('Error fetching Barcelona points:', err?.message || err);
    throw err;
  }
}

/**
 * Sincroniza los puntos de Barcelona con la base de datos.
 */
export async function syncBarcelonaPoints() {
  const start = Date.now();
  const stats = { inserted: 0, updated: 0, deactivated: 0, totalRecords: 0, errors: 0, duration: 0 };
  try {
    const apiPoints = await fetchBarcelonaPoints();

    // IDs existentes en BD
    const existingRows = await prisma.recycling_point.findMany({
      where: { api_location: 'Barcelona' },
      select: { api_id: true },
    });
    const existingIds = new Set(existingRows.map((r) => r.api_id));

    const apiIds = new Set();

    for (const point of apiPoints) {
      apiIds.add(point.api_id);
      try {
        const existed = existingIds.has(point.api_id);
        await prisma.recycling_point.upsert({
          where: { api_location_api_id: { api_location: 'Barcelona', api_id: point.api_id } },
          update: {
            name: point.name,
            latitude: point.latitude,
            longitude: point.longitude,
            equipment_type: point.equipment_type,
            schedule: point.schedule,
            last_updated: point.last_updated,
            raw_payload: point.raw_payload,
            active: true,
            updated_at: new Date(),
          },
          create: point,
        });
        if (existed) stats.updated++;
        else {
          stats.inserted++;
          existingIds.add(point.api_id);
        }
      } catch (e) {
        log.warn(`Error upserting Barcelona point ${point.api_id}: ${e?.message || e}`);
        stats.errors++;
      }
    }

    // Desactivar los que ya no están en la API
    const deactivate = await prisma.recycling_point.updateMany({
      where: { api_location: 'Barcelona', api_id: { notIn: Array.from(apiIds) }, active: true },
      data: { active: false, updated_at: new Date() },
    });
    stats.deactivated = deactivate.count;

    // Total activos
    stats.totalRecords = await prisma.recycling_point.count({ where: { api_location: 'Barcelona', active: true } });
    stats.duration = Date.now() - start;

    log.info(
      `Barcelona sync completed: +${stats.inserted} inserted, ${stats.updated} updated, -${stats.deactivated} deactivated, ` +
        `${stats.errors} errors, ${stats.totalRecords} total active in ${(stats.duration / 1000).toFixed(1)}s`
    );
    return stats;
  } catch (err) {
    stats.duration = Date.now() - start;
    log.error('Barcelona sync failed:', err?.message || err);
    throw err;
  }
}

export { parseBarcelonaPoint };
