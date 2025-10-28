// Recycling Sources Configuration
// Centralized config for all recycling point data sources (Navarra, Barcelona, etc.)

import { syncNavarraPoints } from '#services/navarra-sync.service.js';
import { syncBarcelonaPoints } from '#services/barcelona-sync.service.js';

/**
 * Source configuration map
 * Each zone has:
 * - key: URL-friendly location identifier (lowercase)
 * - source: cache_metadata.source value (UPPERCASE_SNAKE_CASE)
 * - apiLocation: Prisma api_location enum value (PascalCase)
 * - syncFn: async function that syncs this zone's data
 * - cron: cron expression for background sync schedule
 * - ttl: time-to-live in ms (when cache becomes stale)
 * - syncInterval: how often background sync runs in ms
 */
export const RECYCLING_SOURCES = {
  navarra: {
    source: 'NAVARRA_POINTS',
    apiLocation: 'Navarra',
    syncFn: syncNavarraPoints,
    cron: '0 * * * *', // every hour at :00
    ttl: 90 * 60 * 1000, // 1h 30min
    syncInterval: 60 * 60 * 1000, // 1h
  },
  barcelona: {
    source: 'BARCELONA_POINTS',
    apiLocation: 'Barcelona',
    syncFn: syncBarcelonaPoints,
    cron: '15 * * * *', // every hour at :15 (offset to avoid overlap)
    ttl: 90 * 60 * 1000, // 1h 30min
    syncInterval: 60 * 60 * 1000, // 1h
  },
};

/**
 * Get config for a location by key
 * @param {string} location - location key (e.g., 'navarra', 'barcelona')
 * @returns {object|null} config object or null if not found
 */
export function getSourceConfig(location) {
  return RECYCLING_SOURCES[location?.toLowerCase()] || null;
}

/**
 * Get all configured location keys
 * @returns {string[]} array of location keys
 */
export function getAvailableLocations() {
  return Object.keys(RECYCLING_SOURCES);
}

/**
 * Check if a location is supported
 * @param {string} location - location key
 * @returns {boolean}
 */
export function isLocationSupported(location) {
  return location?.toLowerCase() in RECYCLING_SOURCES;
}
