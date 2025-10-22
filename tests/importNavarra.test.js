import fetch from 'node-fetch';
import 'dotenv/config';

/**
 * Test de descarga y parseo del dataset de Navarra
 */
async function testNavarraDataset() {
  console.log('Iniciando test de importación de Navarra...');

  try {
    const url = process.env.DATASET_NAVARRA_URL;
    if (!url) throw new Error('DATASET_NAVARRA_URL no está definida en el archivo .env');

    console.log(`Descargando datos desde: ${url}`);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error HTTP ${response.status} al descargar el dataset`);

    // Elimina BOM y parsea el JSON
    let text = await response.text();
    text = text.replace(/^\uFEFF/, '');

    const json = JSON.parse(text);

    const fields = json.fields?.map((f) => f.id);
    const records = json.records;

    if (!fields || !records || !records.length) {
      console.warn('No se encontraron registros en el JSON.');
      return;
    }

    console.log(`Dataset cargado correctamente con ${records.length} registros.`);
    console.log('Campos detectados:', fields.join(', '));

    // Mapea el dataset a objetos legibles
    const recordObjects = records.map((r) => {
      const obj = {};
      fields.forEach((h, i) => (obj[h] = r[i]));
      return obj;
    });

    console.log('Muestra de los primeros 3 registros:');
    console.log(JSON.stringify(recordObjects.slice(0, 3), null, 2));

    console.log('Test finalizado correctamente.');
  } catch (err) {
    console.error('Error en el test de importación:', err.message);
  }
}

// Permite ejecutar el script directamente: `node src/tests/importNavarra.test.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  testNavarraDataset();
}
