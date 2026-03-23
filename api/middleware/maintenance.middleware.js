import pool from '../config/db.js';
import { MESSAGES } from '../shared/constants/messages.js';

/**
 * maintenanceGuard
 * ----------------
 * Checks the single-row maintenance_mode table.
 * If maintenance is active, returns 503 to 'user' role requests.
 * Admin and superadmin always pass through — they need access to turn it off.
 *
 * Caches the result for 10 seconds to avoid a DB hit on every request.
 */
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 10_000;

const maintenanceGuard = async (req, res, next) => {
  // Privileged roles bypass maintenance
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    return next();
  }

  try {
    const now = Date.now();
    if (!_cache || now - _cacheTime > CACHE_TTL_MS) {
      const result = await pool.query('SELECT is_active, title, message FROM maintenance_mode WHERE id = 1');
      _cache     = result.rows[0] || { is_active: false };
      _cacheTime = now;
    }
    if (_cache.is_active) {
      return res.status(503).json({
        success:     false,
        maintenance: true,
        message:     MESSAGES.MAINTENANCE_BLOCKED,
        title:       _cache.title,
        detail:      _cache.message,
      });
    }
    next();
  } catch (err) {
    // If DB is unreachable, fail open — don't block users unnecessarily
    console.error('[Maintenance] check failed:', err.message);
    next();
  }
};

/** Call this after toggling maintenance to bust the in-process cache immediately. */
const bustMaintenanceCache = () => { _cache = null; _cacheTime = 0; };

export { maintenanceGuard, bustMaintenanceCache };
