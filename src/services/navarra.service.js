import fetch from 'node-fetch';

// Nota importante:
// - Railway (US-West Metal Edge) tiene problemas de conectividad hacia https://datosabiertos.navarra.es/
//   que provocan ETIMEDOUT en producción.
// - Workaround: Enviar las peticiones a través de un Cloudflare Worker (relay/proxy) desplegado en Europa,
//   que sí puede conectar al origen, y devolver la respuesta al backend en streaming.
// - Configura la URL base del Worker en NAVARRA_PROXY_BASE (por ejemplo: https://navarra-proxy.tuorg.workers.dev)
// - Si cambias de Worker/hostname, solo actualiza esta variable de entorno.

const NAVARRA_PROXY_BASE = process.env.NAVARRA_PROXY_BASE; // Configura en Railway, p. ej. https://navarra-proxy.<tu>.workers.dev
// Importante: el timeout del backend debe ser MAYOR que el del Worker para recibir su 502 en vez de abortar antes.
const FETCH_TIMEOUT_MS = Number(process.env.NAVARRA_FETCH_TIMEOUT_MS || 25000); // backend timeout (por defecto 25s)
const WORKER_TIMEOUT_MS = Number(process.env.NAVARRA_WORKER_TIMEOUT_MS || 20000); // worker timeout (por defecto 20s)

function viaWorker(targetUrl) {
  // Envía la URL destino como parámetro al Worker (incluye timeout_ms para que el Worker corte antes)
  return `${NAVARRA_PROXY_BASE}?url=${encodeURIComponent(targetUrl)}&timeout_ms=${WORKER_TIMEOUT_MS}`;
}

// Acepta queryParams como argumento
export async function getNavarraRecyclingPoints(queryParams = {}) {
  const serviceStartTime = Date.now();
  const resourceId = process.env.NAVARRA_RESOURCE_ID;
  const baseUrl = 'https://datosabiertos.navarra.es/es/api/3/action/datastore_search';

  const limit = 1000;
  let offset = 0;
  let allRecords = [];
  let hasMore = true;

  console.log('[NAVARRA SERVICE START] Iniciando descarga:', {
    timestamp: new Date().toISOString(),
    queryParams,
  });

  const { q, ...filters } = queryParams;

  try {
    while (hasMore) {
      let urlParams = `resource_id=${resourceId}&limit=${limit}&offset=${offset}`;

      if (q) {
        urlParams += `&q=${encodeURIComponent(q)}`;
      }

      const filterKeys = Object.keys(filters);
      if (filterKeys.length > 0) {
        const filtersString = JSON.stringify(filters);
        urlParams += `&filters=${encodeURIComponent(filtersString)}`;
      }

      const url = `${baseUrl}?${urlParams}`;

      console.log(`[NAVARRA FETCH START] Consultando página offset=${offset}:`, {
        timestamp: new Date().toISOString(),
        elapsed: `${Date.now() - serviceStartTime}ms`,
        url,
        proxied: true,
        worker: NAVARRA_PROXY_BASE,
      });

      // Fetch con timeout y a través del Worker
      const fetchStartTime = Date.now();
      const ac = new AbortController();
      const timeoutId = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
      let response;
      try {
        console.log('[WORKER FETCH URL]', viaWorker(url));
        response = await fetch(viaWorker(url), { signal: ac.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      console.log(`[NAVARRA FETCH END] Respuesta recibida:`, {
        timestamp: new Date().toISOString(),
        elapsed: `${Date.now() - serviceStartTime}ms`,
        fetchElapsed: `${Date.now() - fetchStartTime}ms`,
        statusCode: response.status,
        ok: response.ok,
        proxied: true,
      });

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status} al consultar CKAN Navarra`);
      }

      const data = await response.json();

      if (!data.success || !data.result?.records) {
        throw new Error('Estructura inesperada en la respuesta de la API CKAN Navarra');
      }

      const records = data.result.records;
      allRecords = allRecords.concat(records);

      console.log(`[NAVARRA PAGE COMPLETE] Página procesada:`, {
        timestamp: new Date().toISOString(),
        elapsed: `${Date.now() - serviceStartTime}ms`,
        recordsInPage: records.length,
        totalRecords: allRecords.length,
      });

      if (records.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    console.log(`[NAVARRA SERVICE END] Descarga completa:`, {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - serviceStartTime}ms`,
      totalRecords: allRecords.length,
    });

    return allRecords;
  } catch (error) {
    console.error('[NAVARRA SERVICE ERROR] Error en descarga:', {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - serviceStartTime}ms`,
      errorCode: error.code,
      errorMessage: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export async function getNavarraRecyclingPointById(id) {
  const serviceStartTime = Date.now();
  const resourceId = process.env.NAVARRA_RESOURCE_ID;
  const baseUrl = 'https://datosabiertos.navarra.es/es/api/3/action/datastore_search';
  // El filtro se debe ENCODEAR siempre
  const filterObj = JSON.stringify({ _id: id });
  const filtersEncoded = encodeURIComponent(filterObj);
  const url = `${baseUrl}?resource_id=${resourceId}&filters=${filtersEncoded}`;

  console.log(`[NAVARRA BY ID START] Consultando punto:`, {
    timestamp: new Date().toISOString(),
    id,
    url,
  });

  try {
    const fetchStartTime = Date.now();
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(viaWorker(url), { signal: ac.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    console.log(`[NAVARRA BY ID FETCH END] Respuesta recibida:`, {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - serviceStartTime}ms`,
      fetchElapsed: `${Date.now() - fetchStartTime}ms`,
      statusCode: response.status,
      ok: response.ok,
      proxied: true,
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} al consultar CKAN Navarra (filtro por ID)`);
    }

    const data = await response.json();

    if (!data.success || !data.result?.records) {
      throw new Error('Estructura inesperada en la respuesta de la API CKAN Navarra (filtro por ID)');
    }

    const record = data.result.records[0] || null;

    console.log(`[NAVARRA BY ID END] Consulta finalizada:`, {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - serviceStartTime}ms`,
      found: !!record,
      id,
    });

    return record;
  } catch (error) {
    console.error('[NAVARRA BY ID ERROR] Error en consulta:', {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - serviceStartTime}ms`,
      id,
      errorCode: error.code,
      errorMessage: error.message,
      isAbort: error.name === 'AbortError',
    });
    throw error;
  }
}
