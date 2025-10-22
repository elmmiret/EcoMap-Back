import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

/**
 * Importa los puntos de reciclaje del Gobierno de Navarra
 */
export async function importNavarraRecyclingPoints() {
  console.log('Iniciando importación de puntos de reciclaje de Navarra...');

  try {
    const url = process.env.DATASET_NAVARRA_URL;
    if (!url) throw new Error('DATASET_NAVARRA_URL no está definida en el archivo .env');

    console.log(`Descargando datos desde: ${url}`);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error HTTP ${response.status} al descargar el dataset`);

    // Limpia el BOM y parsea el JSON
    let text = await response.text();
    text = text.replace(/^\uFEFF/, ''); // elimina el BOM si lo hay

    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      throw new Error(`Error analizando JSON: ${err.message}`);
    }

    const fields = json.fields?.map((f) => f.id);
    const records = json.records;

    if (!fields || !records || !records.length) {
      console.warn('No se encontraron registros en el JSON.');
      return;
    }

    console.log(`Se han descargado ${records.length} registros. Eliminando datos antiguos...`);

    // Borra puntos previos de Navarra
    await prisma.recycling_point.deleteMany({
      where: { api_location: 'Navarra' },
    });

    // Convierte cada registro en un objeto con nombres de columna
    const recordObjects = records.map((r) => {
      const obj = {};
      fields.forEach((h, i) => (obj[h] = r[i]));
      return obj;
    });

    // Procesa y guarda cada punto
    for (const record of recordObjects) {
      const apiId = parseInt(record['ID Equipamiento']);
      const tipo = record['TipoEquipamiento'];
      const horario = record['Horario'];
      const lat = parseFloat(record['x']);
      const lon = parseFloat(record['y']);
      const direccion = record['Direccion'];
      const localidad = record['Localidad'];
      const mancomunidad = record['Mancomunidad'];

      if (!apiId || !lat || !lon) continue;

      // Crea el punto base
      const recyclingPoint = await prisma.recycling_point.create({
        data: {
          api_id: apiId,
          api_location: 'Navarra',
          latitude: lat,
          longitude: lon,
          address: direccion || '',
          city: localidad || '',
          region: mancomunidad || '',
        },
      });

      // Determina el tipo de contenedor
      const containerType = mapContainerType(tipo);

      await prisma.container.create({
        data: {
          type: containerType,
          is_full: false,
          is_damaged: false,
          recycling_point_id: recyclingPoint.recycling_point_id,
        },
      });

      // Procesa el horario si existe
      if (horario && horario.trim() && horario !== '-') {
        const parsed = parseHorario(horario);

        if (parsed) {
          const timetable = await prisma.timetable.create({
            data: {
              week_day: 'Monday', // valor genérico
              recycling_point_id: recyclingPoint.recycling_point_id,
            },
          });

          const timeInterval = await prisma.time_interval.create({
            data: {
              open_time: parsed.start,
              end_time: parsed.end,
            },
          });

          await prisma.timetable_intervals.create({
            data: {
              timetable_id: timetable.timetable_id,
              time_interval_id: timeInterval.time_interval_id,
            },
          });
        }
      }
    }

    console.log(`Importados ${records.length} puntos de reciclaje de Navarra correctamente.`);
  } catch (err) {
    console.error('Error durante la importación de Navarra:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Mapea los tipos del dataset a los valores de tu enum `product_type`
 */
function mapContainerType(tipo) {
  if (!tipo) return 'General waste';
  const normalized = tipo.toLowerCase();

  if (normalized.includes('pilas')) return 'Batteries';
  if (normalized.includes('aceite')) return 'Oil';
  if (normalized.includes('ropa')) return 'Textile';
  if (normalized.includes('móvil')) return 'Hazardous';
  if (normalized.includes('compost')) return 'Organic';
  if (normalized.includes('punto limpio')) return 'Recycling Center';
  return 'General waste';
}

/**
 * Analiza textos como "08:00 - 15:00" o "24 h"
 */
function parseHorario(horario) {
  const regex = /(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/;
  const match = horario.match(regex);

  if (match) {
    return { start: match[1] + ':00', end: match[2] + ':00' };
  } else if (horario.includes('24')) {
    return { start: '00:00:00', end: '23:59:59' };
  }
  return null;
}

// Permite ejecutar el script directamente: `node src/services/navarra.service.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  importNavarraRecyclingPoints();
}
