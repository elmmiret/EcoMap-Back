/**
 * Timetable Service - REESCRITO DESDE CERO
 * Parsea horarios y los guarda en BD sin duplicados
 */
import { prisma } from '#lib/prisma.js';
import { createLogger } from '#lib/logger.js';

const log = createLogger('timetable-service');

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DAY_MAP = {
  domingo: 'Sunday',
  domingos: 'Sunday',
  dom: 'Sunday',
  d: 'Sunday',
  lunes: 'Monday',
  lun: 'Monday',
  l: 'Monday',
  martes: 'Tuesday',
  mar: 'Tuesday',
  m: 'Tuesday',
  miercoles: 'Wednesday',
  miércoles: 'Wednesday',
  mie: 'Wednesday',
  mié: 'Wednesday',
  mi: 'Wednesday',
  x: 'Wednesday',
  jueves: 'Thursday',
  jue: 'Thursday',
  j: 'Thursday',
  viernes: 'Friday',
  vie: 'Friday',
  v: 'Friday',
  sabado: 'Saturday',
  sábado: 'Saturday',
  sáb: 'Saturday',
  sab: 'Saturday',
  s: 'Saturday',
  diumenge: 'Sunday',
  dilluns: 'Monday',
  dimarts: 'Tuesday',
  dimecres: 'Wednesday',
  dijous: 'Thursday',
  divendres: 'Friday',
  dissabte: 'Saturday',
};

const REGEX_TIME = /(\d{1,2})(?:[:.](\d{2}))?\s*(?:-|–|—|a|hasta)\s*(\d{1,2})(?:[:.](\d{2}))?/gi;
const REGEX_DAY =
  /\b(domingo[s]?|lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado[s]?|diumenge[s]?|dilluns|dimarts|dimecres|dijous|divendres|dissabte[s]?|dom|lun|mar|mi[ée]|jue|vie|s[áa]b|[lmxjvsd])\b/gi;

function is24h(str) {
  return /^(24h|24horas?|24hora)$/.test(str.replace(/[\s\u00A0]+/g, '').toLowerCase());
}

export function parseRawSchedule(rawSchedule) {
  if (!rawSchedule?.trim()) return [];

  const clean = rawSchedule
    .replace(/(\d{1,2})\.(\d{2})/g, '$1:$2')
    .replace(/[\s\u00A0]+/g, ' ')
    .trim()
    .toLowerCase();

  if (is24h(clean)) {
    return [{ days: [...WEEK_DAYS], open: '00:00:00', end: '23:59:59' }];
  }

  const dayMatches = [...clean.matchAll(REGEX_DAY)].map((m) => ({ day: DAY_MAP[m[1].toLowerCase()], pos: m.index })).filter((d) => d.day);
  const timeMatches = [...clean.matchAll(REGEX_TIME)];

  if (!timeMatches.length) return [];

  const result = [];
  for (const tm of timeMatches) {
    const h1 = parseInt(tm[1]);
    const m1 = parseInt(tm[2] || 0);
    const h2 = parseInt(tm[3]);
    const m2 = parseInt(tm[4] || 0);

    if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) continue;
    if (h1 * 60 + m1 >= h2 * 60 + m2 && !(h1 === 0 && m1 === 0 && h2 === 23 && m2 === 59)) continue;

    const open = `${String(h1).padStart(2, '0')}:${String(m1).padStart(2, '0')}:00`;
    const end = `${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}:00`;

    let assignedDays = null;
    let minDist = Infinity;
    for (const dm of dayMatches) {
      const dist = Math.abs(dm.pos - tm.index);
      if (dist < minDist && dist < 50) {
        minDist = dist;
        assignedDays = [dm.day];
      }
    }

    result.push({ days: assignedDays || [...WEEK_DAYS], open, end });
  }

  return result;
}

export async function saveTimetable(recyclingPointId, rawSchedule) {
  log.debug('saveTimetable START', { recyclingPointId, rawSchedule });

  const parsed = parseRawSchedule(rawSchedule);

  if (!parsed.length) {
    await prisma.timetable.deleteMany({ where: { recycling_point_id: recyclingPointId } });
    log.debug('saveTimetable: no parsed, deleted all', { recyclingPointId });
    return { created: 0 };
  }

  // Agrupar por día
  const dayMap = new Map();
  for (const p of parsed) {
    for (const day of p.days) {
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day).push({ open: p.open, end: p.end });
    }
  }

  log.debug('saveTimetable: dayMap built', { recyclingPointId, days: [...dayMap.keys()] });

  await prisma.$transaction(async (tx) => {
    // Borrar timetables de días que ya no están en el nuevo horario
    const currentDays = [...dayMap.keys()];
    await tx.timetable.deleteMany({
      where: {
        recycling_point_id: recyclingPointId,
        week_day: { notIn: currentDays },
      },
    });

    // Para cada día, asegurar que existe un timetable (UPSERT REAL)
    for (const [day, intervals] of dayMap.entries()) {
      log.debug('saveTimetable: processing day', { recyclingPointId, day, intervalCount: intervals.length });

      // Usar upsert nativo de Prisma para evitar race conditions
      let timetable;
      try {
        timetable = await tx.timetable.upsert({
          where: {
            recycling_point_id_week_day: {
              recycling_point_id: recyclingPointId,
              week_day: day,
            },
          },
          create: {
            recycling_point_id: recyclingPointId,
            week_day: day,
          },
          // Fuerza ON CONFLICT DO UPDATE para evitar carreras cuando ya existe
          // Hacemos un no-op asignando el mismo valor del día
          update: {
            week_day: day,
          },
        });
        log.debug('saveTimetable: timetable upserted', { recyclingPointId, day, timetableId: timetable.timetable_id });
      } catch (err) {
        log.error('saveTimetable: FAILED upsert timetable', { recyclingPointId, day, error: err.message, stack: err.stack });
        throw err;
      }

      // Borrar enlaces viejos de este timetable
      await tx.timetable_intervals.deleteMany({
        where: { timetable_id: timetable.timetable_id },
      });

      // Crear/encontrar time_intervals y enlazarlos
      for (const intv of intervals) {
        const openDate = new Date(`1970-01-01T${intv.open}`);
        const endDate = new Date(`1970-01-01T${intv.end}`);

        // Usar upsert para time_interval
        const timeInterval = await tx.time_interval.upsert({
          where: {
            open_time_end_time: {
              open_time: openDate,
              end_time: endDate,
            },
          },
          create: {
            open_time: openDate,
            end_time: endDate,
          },
          update: {},
        });

        // Crear enlace solo si no existe
        await tx.timetable_intervals.upsert({
          where: {
            timetable_id_time_interval_id: {
              timetable_id: timetable.timetable_id,
              time_interval_id: timeInterval.time_interval_id,
            },
          },
          create: {
            timetable_id: timetable.timetable_id,
            time_interval_id: timeInterval.time_interval_id,
          },
          update: {},
        });
      }
    }

    log.info('Timetables guardados', { recyclingPointId, days: currentDays.length });
  });

  return { created: dayMap.size };
}

export async function deleteTimetable(recyclingPointId) {
  await prisma.timetable.deleteMany({ where: { recycling_point_id: recyclingPointId } });
  log.info('Timetables eliminados', { recyclingPointId });
}
