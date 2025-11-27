// Scheduler Service: registers cron tasks for background jobs (multi-zone)
// ESM module

import cron from 'node-cron';
import { runSyncJob } from '#jobs/sync-points.job.js';
import { runKeepAliveJob } from '#jobs/keep-alive-ai.job.js';
import { RECYCLING_SOURCES, getAvailableLocations } from '#config/recycling-sources.config.js';
import { createLogger } from '#lib/logger.js';

const log = createLogger('scheduler');

const DEFAULT_TZ = process.env.CRON_TZ || 'Europe/Madrid';

// Store task instances by location key
const taskInstances = new Map();

/**
 * Start background schedulers for all configured zones (idempotent)
 * Returns a Map of location -> cron task instances
 */
export function startSchedulers() {
  const locations = getAvailableLocations();

  locations.forEach((location) => {
    // Skip if task already exists (avoid duplicates in dev watch)
    if (taskInstances.has(location)) {
      log.debug(`${location} task already scheduled, skipping`);
      return;
    }

    const config = RECYCLING_SOURCES[location];
    const { source, syncFn, cron: cronExpr, apiLocation } = config;

    const task = cron.schedule(
      cronExpr,
      async () => {
        try {
          log.info(`Running scheduled sync for ${location}...`);
          await runSyncJob({ source, syncFn, apiLocation });
        } catch (err) {
          log.error(`Unhandled cron error for ${location}:`, err?.message || err);
        }
      },
      { timezone: DEFAULT_TZ }
    );

    taskInstances.set(location, task);
    log.info(`${location} sync scheduled with CRON="${cronExpr}" TZ="${DEFAULT_TZ}"`);
  });

  // Schedule AI Keep Alive (Every day at 02:00 AM)
  // Running every 24h is safe to prevent the 48h sleep timeout.
  if (!taskInstances.has('ai-keep-alive')) {
    const aiTask = cron.schedule(
      '0 2 * * *',
      async () => {
        await runKeepAliveJob();
      },
      { timezone: DEFAULT_TZ }
    );
    taskInstances.set('ai-keep-alive', aiTask);
    log.info('AI Keep Alive scheduled with CRON="0 2 * * *"');
  }

  return taskInstances;
}

/**
 * Stop all running scheduler tasks (useful in tests or graceful shutdown)
 */
export function stopSchedulers() {
  taskInstances.forEach((task, location) => {
    task.stop();
    log.info(`${location} task stopped`);
  });
  taskInstances.clear();
}

/**
 * Run sync immediately for a specific location (manual trigger)
 * @param {string} location - Location key (e.g., 'navarra', 'barcelona')
 */
export async function runSyncNow(location) {
  const config = RECYCLING_SOURCES[location];
  if (!config) {
    throw new Error(`[scheduler] Unknown location: ${location}`);
  }

  const { source, syncFn, apiLocation } = config;
  return runSyncJob({ source, syncFn, apiLocation });
}

/**
 * Warm up caches for all configured locations immediately (e.g., on deploy/startup).
 * Doesn't throw; logs per-location results. Runs in parallel.
 */
export async function warmupCaches() {
  const locations = getAvailableLocations();
  if (!locations.length) {
    log.info('No locations configured for warmup');
    return;
  }

  log.info(`Warmup started for ${locations.length} location(s): ${locations.join(', ')}`);
  const tasks = locations.map(async (location) => {
    const { source, syncFn, apiLocation } = RECYCLING_SOURCES[location];
    try {
      const result = await runSyncJob({ source, syncFn, apiLocation });
      if (result.skipped) {
        log.debug(`Warmup ${location}: skipped (${result.reason})`);
      } else if (result.success) {
        log.info(
          `Warmup ${location}: OK (+${result.inserted} / ${result.updated} / -${result.deactivated})` +
            (result.totalRecords !== undefined ? ` total=${result.totalRecords}` : '')
        );
      } else {
        log.warn(`Warmup ${location}: FAILED - ${result.error || 'unknown error'}`);
      }
    } catch (err) {
      log.error(`Warmup ${location}: CRASH - ${err?.message || err}`);
    }
  });

  await Promise.allSettled(tasks);
  log.info('Warmup finished');
}
