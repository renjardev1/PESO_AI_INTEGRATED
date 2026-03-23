import pool from '../config/db.js';
import { sendError } from '../utils/apiResponse.js';

// Ensure ends_at column exists — runs once on first use, safe to repeat
let schemaChecked = false;
async function ensureSchema() {
  if (schemaChecked) return;
  try {
    await pool.query(`
      ALTER TABLE public.maintenance_mode
        ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ
    `);
    schemaChecked = true;
  } catch (err) {
    console.warn('[Maintenance] schema check:', err.message);
  }
}

export const getMaintenance = async (_req, res) => {
  await ensureSchema();
  try {
    const r = await pool.query('SELECT * FROM maintenance_mode WHERE id = 1');
    const row = r.rows[0] || { is_active: false, title: 'Maintenance', message: '' };
    return res.json({
      active:    row.is_active,
      title:     row.title,
      message:   row.message,
      endsAt:    row.ends_at    || null,
      updatedAt: row.updated_at || null,
    });
  } catch (err) {
    console.error('[Maintenance] get:', err.message);
    return sendError(res, 500, 'Unable to fetch maintenance status');
  }
};

export const setMaintenance = async (req, res) => {
  await ensureSchema();
  const { active, endsAt, title, message } = req.body || {};
  if (typeof active !== 'boolean')
    return sendError(res, 400, 'active must be boolean');

  try {
    const safeEndsAt = active && Number.isFinite(Number(endsAt))
      ? new Date(Number(endsAt)).toISOString()
      : null;

    // updated_by is UUID in original schema — web admin IDs are integers,
    // so we skip that column entirely to avoid type mismatch
    await pool.query(
      `UPDATE maintenance_mode
       SET is_active  = $1,
           title      = COALESCE($2, title),
           message    = COALESCE($3, message),
           ends_at    = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [active, title || null, message || null, safeEndsAt]
    );

    // Bust the in-process cache in mobile's maintenanceGuard
    const { bustMaintenanceCache } = await import('../middleware/maintenance.middleware.js');
    bustMaintenanceCache();

    const r = await pool.query('SELECT * FROM maintenance_mode WHERE id = 1');
    const row = r.rows[0];
    return res.json({
      active:    row.is_active,
      title:     row.title,
      message:   row.message,
      endsAt:    row.ends_at    || null,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    console.error('[Maintenance] set:', err.message);
    return sendError(res, 500, 'Unable to update maintenance mode');
  }
};