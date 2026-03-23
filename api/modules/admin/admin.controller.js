import pool from '../../config/db.js';
import { MESSAGES } from '../../shared/constants/messages.js';
import { parsePagination } from '../../shared/validators/index.js';

// ── GET /api/admin/users  — paginated list, summary only (no raw PII breakdown) ──
const listUsersSummary = async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query, 20, 100);
  const search = req.query.search ? `%${req.query.search}%` : null;
  try {
    const countQ  = search
      ? `SELECT COUNT(*) FROM users WHERE role='user' AND (username ILIKE $1 OR email ILIKE $1)`
      : `SELECT COUNT(*) FROM users WHERE role='user'`;
    const countR  = await pool.query(countQ, search ? [search] : []);
    const total   = parseInt(countR.rows[0].count);

    const dataQ   = search
      ? `SELECT u.id, u.username, u.email, u.created_at, u.is_disabled,
                u.onboarding_completed,
                COUNT(t.id)::int       AS total_transactions,
                COALESCE(MAX(t.created_at),'—') AS last_transaction_at
         FROM users u
         LEFT JOIN transactions t ON u.id = t.user_id
         WHERE u.role='user' AND (u.username ILIKE $1 OR u.email ILIKE $1)
         GROUP BY u.id ORDER BY u.created_at DESC LIMIT $2 OFFSET $3`
      : `SELECT u.id, u.username, u.email, u.created_at, u.is_disabled,
                u.onboarding_completed,
                COUNT(t.id)::int       AS total_transactions,
                COALESCE(MAX(t.created_at),'—') AS last_transaction_at
         FROM users u
         LEFT JOIN transactions t ON u.id = t.user_id
         WHERE u.role='user'
         GROUP BY u.id ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`;
    const dataR = await pool.query(dataQ, search ? [search, limit, offset] : [limit, offset]);

    return res.json({
      success: true,
      data: {
        users: dataR.rows,
        total, page, limit, totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[Admin] listUsersSummary:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.ADMIN_USER_LIST_FAILED });
  }
};

// ── GET /api/admin/users/:userId  — single user summary (no raw transaction data) ──
const getUserSummary = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.username, u.email, u.created_at, u.is_disabled,
        u.onboarding_completed, u.disabled_reason, u.disabled_at,
        p.occupation, p.monthly_income, p.budget_period,
        COUNT(t.id)::int                                            AS total_transactions,
        COALESCE(SUM(t.amount),0)                                   AS total_spent,
        COALESCE(AVG(t.amount),0)                                   AS avg_transaction,
        COALESCE(MAX(t.transaction_date)::text, 'No transactions')  AS last_transaction_date,
        COUNT(DISTINCT t.category)::int                             AS categories_used,
        COUNT(DISTINCT sg.id)::int                                  AS total_goals,
        COALESCE(SUM(sg.current_amount),0)                         AS total_saved
      FROM users u
      LEFT JOIN user_profiles  p  ON u.id = p.user_id
      LEFT JOIN transactions   t  ON u.id = t.user_id
      LEFT JOIN savings_goals  sg ON u.id = sg.user_id
      WHERE u.id = $1 AND u.role = 'user'
      GROUP BY u.id, p.occupation, p.monthly_income, p.budget_period
    `, [userId]);

    if (!result.rowCount) return res.status(404).json({ success: false, message: MESSAGES.ADMIN_USER_NOT_FOUND });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Admin] getUserSummary:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.ADMIN_SUMMARY_FAILED });
  }
};

// ── GET /api/admin/platform-stats ─────────────────────────────────────────────
const getPlatformStats = async (req, res) => {
  try {
    const [users, tx, goals, announcements] = await Promise.all([
      pool.query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE-INTERVAL '30 days')::int AS new_30d,
        COUNT(*) FILTER (WHERE is_disabled=TRUE)::int AS disabled
        FROM users WHERE role='user'`),
      pool.query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE-INTERVAL '7 days')::int  AS last_7d,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE-INTERVAL '30 days')::int AS last_30d,
        COALESCE(SUM(amount),0) AS total_volume
        FROM transactions`),
      pool.query(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='completed')::int AS completed FROM savings_goals`),
      pool.query(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_active=TRUE)::int AS active FROM announcements`),
    ]);
    return res.json({
      success: true,
      stats: {
        users:         users.rows[0],
        transactions:  tx.rows[0],
        goals:         goals.rows[0],
        announcements: announcements.rows[0],
      },
    });
  } catch (err) {
    console.error('[Admin] getPlatformStats:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.ADMIN_SUMMARY_FAILED });
  }
};

export { listUsersSummary, getUserSummary, getPlatformStats };