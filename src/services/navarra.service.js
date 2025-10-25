import fetch from 'node-fetch';

// Acepta queryParams como argumento
export async function getNavarraRecyclingPoints(queryParams = {}) {
  const resourceId = process.env.NAVARRA_RESOURCE_ID;
  const baseUrl = 'https://datosabiertos.navarra.es/es/api/3/action/datastore_search';

  const limit = 1000;
  let offset = 0;
  let allRecords = [];
  let hasMore = true;

  console.log('♻️ Descargando puntos de reciclaje desde CKAN Navarra...');

  // Separa 'q' (búsqueda full-text) del resto de filtros
  const { q, ...filters } = queryParams;

  while (hasMore) {
    // Construye los parámeteos de la URL dinámicamente
    let urlParams = `resource_id=${resourceId}&limit=${limit}&offset=${offset}`;

    if (q) {
      urlParams += `&q=${encodeURIComponent(q)}`;
    }

    // Si hay filtros (ej: municipio=Pamplona), los convierte en JSON
    const filterKeys = Object.keys(filters);
    if (filterKeys.length > 0) {
      const filtersString = JSON.stringify(filters);
      urlParams += `&filters=${encodeURIComponent(filtersString)}`;
    }

    const url = `${baseUrl}?${urlParams}`;

    console.log(`Consultando: ${url}`); // para depurar

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
