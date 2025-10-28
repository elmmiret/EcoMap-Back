// Simple leveled logger with optional namespace filtering via env

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };

const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const GLOBAL_LEVEL = LEVELS[envLevel] ?? LEVELS.info;

// Comma-separated list of namespace patterns: e.g. "navarra*,cache,scheduler"
// Supports "*" wildcard (prefix/suffix/contains)
const NAMESPACE_FILTER = (process.env.LOG_NAMESPACES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function matchPattern(str, pattern) {
  if (pattern === '*') return true;
  const esc = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*');
  const re = new RegExp(`^${esc}$`, 'i');
  return re.test(str);
}

function isNamespaceEnabled(ns) {
  if (NAMESPACE_FILTER.length === 0) return true; // no filter => allow all
  return NAMESPACE_FILTER.some((p) => matchPattern(ns, p));
}

function ts() {
  return new Date().toISOString();
}

export function createLogger(namespace = 'app') {
  function shouldLog(levelName) {
    const lvl = LEVELS[levelName];
    if (lvl === undefined) return false;
    if (lvl > GLOBAL_LEVEL) return false;
    // For verbose levels, honor namespace filter more strictly
    if (lvl >= LEVELS.debug) return isNamespaceEnabled(namespace);
    return true;
  }

  function format(levelName, args) {
    return [`[${levelName.toUpperCase()}][${namespace}]`, ts(), ...args];
  }

  return {
    level: envLevel,
    error: (...args) => shouldLog('error') && console.error(...format('error', args)),
    warn: (...args) => shouldLog('warn') && console.warn(...format('warn', args)),
    info: (...args) => shouldLog('info') && console.log(...format('info', args)),
    debug: (...args) => shouldLog('debug') && console.log(...format('debug', args)),
    trace: (...args) => shouldLog('trace') && console.log(...format('trace', args)),
  };
}

// Convenience default logger
export const logger = createLogger('app');
