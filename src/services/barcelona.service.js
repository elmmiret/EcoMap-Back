import fetch from 'node-fetch';

// Acepta queryParams como argumento
export async function getBarcelonaRecyclingPoints(queryParams = {}) {
  const serviceStartTime = Date.now();
  const resourceId = process.env.BARCELONA_RESOURCE_ID;
  const baseUrl = 'https://opendata-ajuntament.barcelona.cat/data/api/3/action/datastore_search';

  const limit = 1000;
  let offset = 0;
  let allRecords = [];
  let hasMore = true;

  console.log('[BARCELONA SERVICE START] Iniciando descarga:', {
    timestamp: new Date().toISOString(),
    queryParams,
  });

  const { q, ...filters } = queryParams;

  try {
    while (hasMore) {
      const fetchStartTime = Date.now();
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

      console.log(`[BARCELONA FETCH START] Consultando página offset=${offset}:`, {
        timestamp: new Date().toISOString(),
        elapsed: `${Date.now() - serviceStartTime}ms`,
        url,
      });

      const response = await fetch(url);

      console.log(`[BARCELONA FETCH END] Respuesta recibida:`, {
        timestamp: new Date().toISOString(),
        elapsed: `${Date.now() - serviceStartTime}ms`,
        fetchElapsed: `${Date.now() - fetchStartTime}ms`,
        statusCode: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status} al consultar CKAN Barcelona`);
      }

      const data = await response.json();

      if (!data.success || !data.result?.records) {
        throw new Error('Estructura inesperada en la respuesta de la API CKAN Barcelona');
      }

      const records = data.result.records;
      allRecords = allRecords.concat(records);

      console.log(`[BARCELONA PAGE COMPLETE] Página procesada:`, {
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

    console.log(`[BARCELONA SERVICE END] Descarga completa:`, {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - serviceStartTime}ms`,
      totalRecords: allRecords.length,
    });

    return allRecords;
  } catch (error) {
    console.error('[BARCELONA SERVICE ERROR] Error en descarga:', {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - serviceStartTime}ms`,
      errorCode: error.code,
      errorMessage: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export async function getBarcelonaRecyclingPointById(id) {
  const serviceStartTime = Date.now();
  const resourceId = process.env.BARCELONA_RESOURCE_ID;
  const baseUrl = 'https://opendata-ajuntament.barcelona.cat/data/api/3/action/datastore_search';
  const url = `${baseUrl}?resource_id=${resourceId}&filters={"_id":${id}}`;

  console.log(`[BARCELONA BY ID START] Consultando punto:`, {
    timestamp: new Date().toISOString(),
    id,
    url,
  });

  try {
    const fetchStartTime = Date.now();
    const response = await fetch(url);

    console.log(`[BARCELONA BY ID FETCH END] Respuesta recibida:`, {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - serviceStartTime}ms`,
      fetchElapsed: `${Date.now() - fetchStartTime}ms`,
      statusCode: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} al consultar CKAN Barcelona (filtro por ID)`);
    }

    const data = await response.json();

    if (!data.success || !data.result?.records) {
      throw new Error('Estructura inesperada en la respuesta de la API CKAN Barcelona (filtro por ID)');
    }

    const record = data.result.records[0] || null;

    console.log(`[BARCELONA BY ID END] Consulta finalizada:`, {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - serviceStartTime}ms`,
      found: !!record,
      id,
    });

    return record;
  } catch (error) {
    console.error('[BARCELONA BY ID ERROR] Error en consulta:', {
      timestamp: new Date().toISOString(),
      elapsed: `${Date.now() - serviceStartTime}ms`,
      id,
      errorCode: error.code,
      errorMessage: error.message,
    });
    throw error;
  }
}
