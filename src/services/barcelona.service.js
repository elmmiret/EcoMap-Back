import fetch from 'node-fetch';

export async function getBarcelonaRecyclingPoints() {
  const resourceId = process.env.BARCELONA_RESOURCE_ID;
  const baseUrl = 'https://opendata-ajuntament.barcelona.cat/data/api/3/action/datastore_search';

  const limit = 1000;
  let offset = 0;
  let allRecords = [];
  let hasMore = true;

  console.log('♻️ Descargando puntos de reciclaje desde CKAN Barcelona...');

  while (hasMore) {
    const url = `${baseUrl}?resource_id=${resourceId}&limit=${limit}&offset=${offset}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} al consultar CKAN Barcelona`);
    }

    const data = await response.json();

    if (!data.success || !data.result?.records) {
      throw new Error('Estructura inesperada en la respuesta de la API CKAN Barcelona');
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

  console.log(`✅ Descarga completa: ${allRecords.length} puntos totales en Barcelona`);
  return allRecords;
}
