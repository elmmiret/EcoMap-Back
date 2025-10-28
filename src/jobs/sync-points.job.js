// Generic Job: Sync recycling points for any location and update cache metadata
// ESM module

import { prisma } from '#lib/prisma.js';
import { ensureMetadata, markStatus, getSyncIntervalMs } from '#services/cache.service.js';
import { createLogger } from '#lib/logger.js';

const log = createLogger('sync-job');

/**
 * Run sync job for a specific source (idempotent and overlap-safe via metadata.status)
 * - Ensures metadata exists
 * - Skips if a sync is already in progress
 * - Sets status to SYNCING, performs sync, then updates metadata
 *
 * @param {Object} params - Job parameters
 * @param {string} params.source - Cache source key (e.g., 'NAVARRA_POINTS', 'BARCELONA_POINTS')
 * @param {Function} params.syncFn - Async sync function to execute
 * @param {string} [params.apiLocation] - Optional: api_location for counting records (if not provided in syncFn result)
 * @returns {Promise<{success: boolean, skipped?: boolean, reason?: string, inserted?: number, updated?: number, deactivated?: number, totalRecords?: number, syncDurationMs?: number, error?: string}>}
 */
export async function runSyncJob({ source, syncFn, apiLocation }) {
  if (!source || !syncFn) {
    throw new Error('[job] runSyncJob requires source and syncFn parameters');
  }

  const started = Date.now();
  const SYNC_INTERVAL_MS = getSyncIntervalMs(source);

  // Ensure metadata row exists
  const meta = await ensureMetadata(source);

  // Avoid overlapping runs
  if (meta.status === 'SYNCING') {
    console.log(`[job] ${source} sync skipped: already SYNCING`);
    return { success: false, skipped: true, reason: 'SYNC_IN_PROGRESS' };
  }

  // Flip status to SYNCING
  await markStatus(source, 'SYNCING');

  try {
    const result = await syncFn();

    // Determine total records (prefer returned metric, fallback to DB count if apiLocation provided)
    let total = typeof result?.totalRecords === 'number' ? result.totalRecords : undefined;

    if (total === undefined && apiLocation) {
      total = await prisma.recycling_point.count({
        where: { api_location: apiLocation, active: true },
      });
    }

    await markStatus(source, 'READY', {
      last_sync: new Date(),
      next_sync: new Date(Date.now() + SYNC_INTERVAL_MS),
      ...(typeof total === 'number' ? { total_records: total } : {}),
      error_message: null,
    });

    const duration = Date.now() - started;
    log.info(
      `${source} sync OK: +${result.inserted} inserted, ${result.updated} updated, -${result.deactivated} deactivated${
        total !== undefined ? ` (${total} total)` : ''
      } in ${(duration / 1000).toFixed(1)}s`
    );

    return {
      success: true,
      inserted: result.inserted,
      updated: result.updated,
      deactivated: result.deactivated,
      totalRecords: total,
      syncDurationMs: duration,
    };
  } catch (err) {
    const message = err?.message || String(err);
    await markStatus(source, 'ERROR', {
      error_message: message.slice(0, 500),
      next_sync: new Date(Date.now() + SYNC_INTERVAL_MS),
    });

    log.error(`${source} sync FAILED:`, message);
    return { success: false, error: message };
  }
}
