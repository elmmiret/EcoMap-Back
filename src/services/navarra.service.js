import fetch from 'node-fetch';

/**
 * Obtiene todos los puntos de reciclaje de Navarra (paginado)
 */
export async function getNavarraRecyclingPoints() {
  const resourceId = process.env.NAVARRA_RESOURCE_ID;
  const baseUrl = 'https://datosabiertos.navarra.es/es/api/3/action/datastore_search';

  const limit = 1000;
  let offset = 0;
  let allRecords = [];
  let hasMore = true;

  console.log('♻️ Descargando puntos de reciclaje desde CKAN Navarra...');

  while (hasMore) {
    const url = `${baseUrl}?resource_id=${resourceId}&limit=${limit}&offset=${offset}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} al consultar CKAN Navarra`);
    }

    const data = await response.json();

    if (!data.success || !data.result?.records) {
      throw new Error('Estructura inesperada en la respuesta de la API CKAN Navarra');
    }

    const records = data.result.records;
    allRecords = allRecords.concat(records);

    console.log(`📦 Cargados ${records.length} registros (total: ${allRecords.length})`);

    if (records.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  console.log(`✅ Descarga completa: ${allRecords.length} puntos totales en Navarra`);
  return allRecords;
}

export async function getNavarraRecyclingPointById(id) {
  const resourceId = process.env.NAVARRA_RESOURCE_ID;
  const baseUrl = 'https://datosabiertos.navarra.es/es/api/3/action/datastore_search';

  // CKAN permite filtrar registros directamente por campos
  const url = `${baseUrl}?resource_id=${resourceId}&filters={"_id":${id}}`;

  console.log(`🔍 Consultando punto de reciclaje de Navarra con ID: ${id}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status} al consultar CKAN Navarra (filtro por ID)`);
  }

  const data = await response.json();

  if (!data.success || !data.result?.records) {
    throw new Error('Estructura inesperada en la respuesta de la API CKAN Navarra (filtro por ID)');
  }

  const record = data.result.records[0] || null;

  if (record) {
    console.log(`✅ Punto encontrado en Navarra: _id=${id}`);
  } else {
    console.log(`⚠️ No se ha encontrado ningún punto en Navarra con _id=${id}`);
  }

  return record;
}
