import pool from '../config/db.js';

/**
 * logAccess
 * ---------
 * Records superadmin access to sensitive user-level data.
 * Applied as route-level middleware on specific superadmin endpoints.
 *
 * Extracts target_user_id from req.params.userId when present.
 * Non-blocking — logs asynchronously and never fails the request.
 */
const logAccess = (req, res, next) => {
  // Fire-and-forget — always call next() immediately
  next();

  setImmediate(async () => {
    try {
      const actorId      = req.admin?.id   || req.user?.id || null;
      const actorRole    = req.admin?.role || req.user?.role || 'unknown';
      const targetUserId = req.params?.userId || null;
      const method       = req.method;
      const endpoint     = req.originalUrl;

      if (!actorId) return;

      await pool.query(
        `INSERT INTO access_logs (actor_id, actor_role, target_user_id, method, endpoint)
         VALUES ($1, $2, $3, $4, $5)`,
        [actorId, actorRole, targetUserId, method, endpoint]
      );
    } catch (err) {
      console.error('[AccessLog] write failed:', err.message);
    }
  });
};

export { logAccess };
