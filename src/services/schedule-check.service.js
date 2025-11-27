/**
 * Schedule Check Service
 *
 * RESPONSABILIDAD: Verificar si puntos de reciclaje están abiertos consultando la BD
 * Reemplaza el antiguo schedule-checker.js con queries directas a timetable
 */

import { prisma } from '#lib/prisma.js';
import { createLogger } from '#lib/logger.js';

const log = createLogger('schedule-check-service');

const DAY_MAP = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

/**
 * Verifica si un punto de reciclaje está abierto en un momento específico
 * consultando directamente la BD
 *
 * @param {string} recyclingPointId - UUID del recycling_point
 * @param {Date} datetime - Fecha/hora a verificar (se interpreta como hora local del usuario)
 * @returns {Promise<boolean>} true si el punto está abierto
 */
export async function isOpenAt(recyclingPointId, datetime = new Date()) {
  const dayOfWeek = DAY_MAP[datetime.getDay()];
  
  // Convertir hora local a UTC para comparación con datos en BD
  // getTimezoneOffset() devuelve minutos (negativo para UTC+, positivo para UTC-)
  const timezoneOffsetMs = -datetime.getTimezoneOffset() * 60 * 1000; // Invertir el signo
  const utcDatetime = new Date(datetime.getTime() + timezoneOffsetMs);
  const currentTime = utcDatetime.toISOString().split('T')[1].slice(0, 8); // HH:MM:SS en UTC

  // Buscar timetables del punto para el día de la semana actual
  const timetables = await prisma.timetable.findMany({
    where: {
      recycling_point_id: recyclingPointId,
      week_day: dayOfWeek,
    },
    include: {
      timetable_intervals: {
        include: {
          time_interval: true,
        },
      },
    },
  });

  if (!timetables.length) {
    log.debug('No hay horarios definidos para este punto', { recyclingPointId, dayOfWeek });
    return false;
  }

  // Verificar si algún intervalo incluye la hora actual
  for (const timetable of timetables) {
    for (const ti of timetable.timetable_intervals) {
      const openTime = ti.time_interval.open_time.toISOString().split('T')[1].slice(0, 8); // HH:MM:SS
      const endTime = ti.time_interval.end_time.toISOString().split('T')[1].slice(0, 8); // HH:MM:SS

      if (currentTime >= openTime && currentTime < endTime) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Filtra un array de IDs de puntos de reciclaje por horario
 * Devuelve solo los IDs de puntos que están abiertos en el momento dado
 *
 * @param {string[]} recyclingPointIds - Array de UUIDs de recycling_points
 * @param {Date} datetime - Fecha/hora a verificar (se interpreta como hora local del usuario)
 * @returns {Promise<string[]>} Array de IDs de puntos abiertos
 */
export async function filterOpenPoints(recyclingPointIds, datetime = new Date()) {
  if (!Array.isArray(recyclingPointIds) || !recyclingPointIds.length) {
    return [];
  }

  const dayOfWeek = DAY_MAP[datetime.getDay()];
  
  // Convertir hora local a UTC para comparación con datos en BD
  // getTimezoneOffset() devuelve minutos (negativo para UTC+, positivo para UTC-)
  const timezoneOffsetMs = -datetime.getTimezoneOffset() * 60 * 1000; // Invertir el signo
  const utcDatetime = new Date(datetime.getTime() + timezoneOffsetMs);
  const currentTime = utcDatetime.toISOString().split('T')[1].slice(0, 8); // HH:MM:SS en UTC

  // Query optimizada: buscar todos los timetables relevantes en una sola consulta
  const timetables = await prisma.timetable.findMany({
    where: {
      recycling_point_id: { in: recyclingPointIds },
      week_day: dayOfWeek,
    },
    include: {
      timetable_intervals: {
        include: {
          time_interval: true,
        },
      },
    },
  });

  // Agrupar por recycling_point_id y verificar
  const openPointsSet = new Set();
  for (const timetable of timetables) {
    for (const ti of timetable.timetable_intervals) {
      const openTime = ti.time_interval.open_time.toISOString().split('T')[1].slice(0, 8);
      const endTime = ti.time_interval.end_time.toISOString().split('T')[1].slice(0, 8);

      if (currentTime >= openTime && currentTime < endTime) {
        openPointsSet.add(timetable.recycling_point_id);
        break; // Ya sabemos que está abierto, no necesitamos verificar más intervalos
      }
    }
  }

  return Array.from(openPointsSet);
}

/**
 * Filtra un array de objetos de puntos de reciclaje por horario
 * Devuelve solo los puntos que están abiertos en el momento dado
 *
 * @param {Array<{recycling_point_id: string}>} points - Array de puntos con recycling_point_id
 * @param {Date} datetime - Fecha/hora a verificar (por defecto: ahora)
 * @returns {Promise<Array>} Array de puntos abiertos
 */
export async function filterBySchedule(points, datetime = new Date()) {
  if (!Array.isArray(points) || !points.length) {
    return [];
  }

  const ids = points.map((p) => p.recycling_point_id).filter(Boolean);
  if (!ids.length) return [];

  const openIds = await filterOpenPoints(ids, datetime);
  const openIdsSet = new Set(openIds);

  return points.filter((p) => openIdsSet.has(p.recycling_point_id));
}

/**
 * Obtiene un query Prisma optimizado para filtrar puntos abiertos
 * Útil para añadir como WHERE condition en queries complejas
 *
 * @param {Date} datetime - Fecha/hora a verificar (por defecto: ahora)
 * @returns {Object} Objeto de condición Prisma para timetable
 */
export function getOpenNowCondition(datetime = new Date()) {
  const dayOfWeek = DAY_MAP[datetime.getDay()];
  const currentTime = datetime.toTimeString().split(' ')[0];

  return {
    timetable: {
      some: {
        week_day: dayOfWeek,
        timetable_intervals: {
          some: {
            time_interval: {
              AND: [{ open_time: { lte: new Date(`1970-01-01T${currentTime}`) } }, { end_time: { gt: new Date(`1970-01-01T${currentTime}`) } }],
            },
          },
        },
      },
    },
  };
}

/**
 * Obtiene los horarios de un punto para un día específico
 * Los horarios se devuelven en la zona horaria local del usuario (p.ej., UTC+1)
 * @param {string} recyclingPointId - UUID del recycling_point
 * @param {Date} datetime - Fecha para obtener el día de la semana
 * @returns {Promise<Array>} Array de intervalos horarios { open_time, end_time } en zona local
 */
export async function getTimetableForDay(recyclingPointId, datetime = new Date()) {
  const dayOfWeek = DAY_MAP[datetime.getDay()];

  const timetables = await prisma.timetable.findMany({
    where: {
      recycling_point_id: recyclingPointId,
      week_day: dayOfWeek,
    },
    include: {
      timetable_intervals: {
        include: {
          time_interval: true,
        },
      },
    },
  });

  if (!timetables.length) {
    return [];
  }

  // Obtener offset para convertir de UTC a zona local
  const timezoneOffsetMs = -datetime.getTimezoneOffset() * 60 * 1000;

  // Extraer todos los intervalos y formatearlos en zona local
  const intervals = [];
  for (const timetable of timetables) {
    for (const ti of timetable.timetable_intervals) {
      // Convertir de UTC a zona local
      const openTimeUTC = new Date(ti.time_interval.open_time);
      const endTimeUTC = new Date(ti.time_interval.end_time);
      
      const openTimeLocal = new Date(openTimeUTC.getTime() + timezoneOffsetMs);
      const endTimeLocal = new Date(endTimeUTC.getTime() + timezoneOffsetMs);
      
      intervals.push({
        open_time: openTimeLocal.toISOString().split('T')[1].slice(0, 8), // HH:MM:SS en zona local
        end_time: endTimeLocal.toISOString().split('T')[1].slice(0, 8), // HH:MM:SS en zona local
      });
    }
  }

  return intervals;
}

/**
 * Obtiene los horarios de múltiples puntos para un día específico
 * Los horarios se devuelven en la zona horaria local del usuario (p.ej., UTC+1)
 * @param {string[]} recyclingPointIds - Array de UUIDs
 * @param {Date} datetime - Fecha para obtener el día de la semana
 * @returns {Promise<Map<string, Array>>} Map de recycling_point_id -> array de intervalos { open_time, end_time } en zona local
 */
export async function getTimetablesForDay(recyclingPointIds, datetime = new Date()) {
  if (!Array.isArray(recyclingPointIds) || !recyclingPointIds.length) {
    return new Map();
  }

  const dayOfWeek = DAY_MAP[datetime.getDay()];

  const timetables = await prisma.timetable.findMany({
    where: {
      recycling_point_id: { in: recyclingPointIds },
      week_day: dayOfWeek,
    },
    include: {
      timetable_intervals: {
        include: {
          time_interval: true,
        },
      },
    },
  });

  // Obtener offset para convertir de UTC a zona local
  const timezoneOffsetMs = -datetime.getTimezoneOffset() * 60 * 1000;

  // Agrupar por recycling_point_id
  const result = new Map();
  for (const timetable of timetables) {
    if (!result.has(timetable.recycling_point_id)) {
      result.set(timetable.recycling_point_id, []);
    }
    for (const ti of timetable.timetable_intervals) {
      // Convertir de UTC a zona local
      const openTimeUTC = new Date(ti.time_interval.open_time);
      const endTimeUTC = new Date(ti.time_interval.end_time);
      
      const openTimeLocal = new Date(openTimeUTC.getTime() + timezoneOffsetMs);
      const endTimeLocal = new Date(endTimeUTC.getTime() + timezoneOffsetMs);
      
      result.get(timetable.recycling_point_id).push({
        open_time: openTimeLocal.toISOString().split('T')[1].slice(0, 8), // HH:MM:SS en zona local
        end_time: endTimeLocal.toISOString().split('T')[1].slice(0, 8), // HH:MM:SS en zona local
      });
    }
  }

  return result;
}

/**
 * Filtra puntos que ya tienen el campo timetable enriquecido
 * Versión optimizada que no consulta la BD, usa los datos en memoria
 *
 * @param {Array<{timetable: Array<{open_time: string, end_time: string}>}>} points - Array de puntos con campo timetable
 * @param {Date} datetime - Fecha/hora a verificar (se interpreta como hora local del usuario, se convierte a UTC para comparación)
 * @returns {Array} Array de puntos abiertos
 */
export function filterByScheduleInMemory(points, datetime = new Date()) {
  if (!Array.isArray(points) || !points.length) {
    return [];
  }

  // IMPORTANTE: Los horarios en BD están en UTC (sin zona horaria)
  // El datetime recibido es hora local del usuario (p.ej., UTC+1)
  // Convertimos datetime a UTC para comparar correctamente
  // getTimezoneOffset() devuelve minutos (negativo para UTC+, positivo para UTC-)
  const timezoneOffsetMs = -datetime.getTimezoneOffset() * 60 * 1000; // Invertir el signo
  const utcDatetime = new Date(datetime.getTime() + timezoneOffsetMs);
  
  const hours = String(utcDatetime.getUTCHours()).padStart(2, '0');
  const minutes = String(utcDatetime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(utcDatetime.getUTCSeconds()).padStart(2, '0');
  const currentTimeUTC = `${hours}:${minutes}:${seconds}`; // HH:MM:SS en UTC

  return points.filter((point) => {
    // Si no tiene timetable o está vacío, excluir
    if (!point.timetable || !Array.isArray(point.timetable) || point.timetable.length === 0) {
      return false;
    }

    // Verificar si algún intervalo incluye la hora actual (ambos en UTC)
    return point.timetable.some((interval) => {
      const openTime = interval.open_time;
      const endTime = interval.end_time;
      return currentTimeUTC >= openTime && currentTimeUTC < endTime;
    });
  });
}
