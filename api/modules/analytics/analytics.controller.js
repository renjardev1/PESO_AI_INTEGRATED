import pool from '../../config/db.js';
import { getDailySpending, getCategoryBreakdown, getTopCategories,
  getSpendingTrend, getAnalyticsSummary, } from '../../shared/models/analytics.model.js';
import { isValidDate, isValidTrendPeriod, validationError } from '../../shared/validators/index.js';
import { MESSAGES } from '../../shared/constants/messages.js';

// ── GET /api/user/analytics/:userId  (user — own data) ───────────────────────
const getAnalytics = async (req, res) => {
  const { userId }             = req.params;
  const { startDate, endDate } = req.query;
  if (!isValidDate(startDate)) return validationError(res, 'Start date is required (YYYY-MM-DD).');
  if (!isValidDate(endDate))   return validationError(res, 'End date is required (YYYY-MM-DD).');
  if (startDate > endDate)     return validationError(res, 'Start date must be before or equal to end date.');
  try {
    const [dailySpending, categoryBreakdown, topCategories, summary] = await Promise.all([
      getDailySpending(userId, startDate, endDate),
      getCategoryBreakdown(userId, startDate, endDate),
      getTopCategories(userId, startDate, endDate, 5),
      getAnalyticsSummary(userId, startDate, endDate),
    ]);
    return res.json({ success: true, dailySpending, categoryBreakdown, topCategories, summary });
  } catch (err) {
    console.error('[Analytics] getAnalytics:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.ANALYTICS_FETCH_FAILED });
  }
};

const getSpendingTrendData = async (req, res) => {
  const { userId } = req.params;
  const months = Math.min(Math.max(parseInt(req.query.months, 10) || 6, 1), 24);
  try {
    const trend = await getSpendingTrend(userId, months);
    return res.json({ success: true, trend });
  } catch (err) {
    console.error('[Analytics] getSpendingTrendData:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.ANALYTICS_TREND_FAILED });
  }
};

const getTrendData = async (req, res) => {
  const { userId } = req.params;
  const { period = 'month' } = req.query;
  if (!isValidTrendPeriod(period)) return validationError(res, MESSAGES.INVALID_PERIOD);
  try {
    let query;
    if (period === 'week') {
      query = `WITH date_series AS (
        SELECT generate_series(CURRENT_DATE-INTERVAL '6 days',CURRENT_DATE,'1 day'::interval)::date AS date
      )
      SELECT TO_CHAR(ds.date,'Dy') AS label,
        COALESCE(SUM(CASE WHEN t.transaction_type='expense' THEN t.amount END),0) AS spending,
        COALESCE(SUM(CASE WHEN t.transaction_type='income'  THEN t.amount END),0) AS income
      FROM date_series ds
      LEFT JOIN transactions t ON DATE(t.transaction_date)=ds.date AND t.user_id=$1
      GROUP BY ds.date ORDER BY ds.date`;
    } else if (period === 'month') {
      query = `WITH week_ranges AS (
        SELECT 1 AS wn,CURRENT_DATE-INTERVAL '27 days' AS s,CURRENT_DATE-INTERVAL '21 days' AS e
        UNION ALL SELECT 2,CURRENT_DATE-INTERVAL '20 days',CURRENT_DATE-INTERVAL '14 days'
        UNION ALL SELECT 3,CURRENT_DATE-INTERVAL '13 days',CURRENT_DATE-INTERVAL '7 days'
        UNION ALL SELECT 4,CURRENT_DATE-INTERVAL '6 days',CURRENT_DATE
      )
      SELECT 'Week '||wr.wn AS label,
        COALESCE(SUM(CASE WHEN t.transaction_type='expense' THEN t.amount END),0) AS spending,
        COALESCE(SUM(CASE WHEN t.transaction_type='income'  THEN t.amount END),0) AS income
      FROM week_ranges wr
      LEFT JOIN transactions t ON t.user_id=$1 AND DATE(t.transaction_date) BETWEEN wr.s AND wr.e
      GROUP BY wr.wn,label ORDER BY wr.wn`;
    } else {
      query = `WITH month_series AS (
        SELECT generate_series(
          DATE_TRUNC('month',CURRENT_DATE-INTERVAL '11 months'),
          DATE_TRUNC('month',CURRENT_DATE),'1 month'::interval)::date AS md
      )
      SELECT TO_CHAR(ms.md,'Mon') AS label,
        COALESCE(SUM(CASE WHEN t.transaction_type='expense' THEN t.amount END),0) AS spending,
        COALESCE(SUM(CASE WHEN t.transaction_type='income'  THEN t.amount END),0) AS income
      FROM month_series ms
      LEFT JOIN transactions t ON DATE_TRUNC('month',t.transaction_date)=ms.md AND t.user_id=$1
      GROUP BY ms.md ORDER BY ms.md`;
    }
    const result = await pool.query(query, [userId]);
    const data = result.rows.map(r => ({
      label: r.label, spending: parseFloat(r.spending||0), income: parseFloat(r.income||0),
    }));
    return res.json({ success: true, period, data });
  } catch (err) {
    console.error('[Analytics] getTrendData:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.ANALYTICS_TREND_DATA_FAILED });
  }
};

// ── GET /api/analytics/summary  (admin + superadmin) ─────────────────────────
// Platform-wide aggregated stats — no user-level PII exposed.
const getPlatformSummary = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(DISTINCT u.id)                                          AS total_users,
        COUNT(DISTINCT CASE WHEN u.created_at >= CURRENT_DATE - INTERVAL '30 days'
                            THEN u.id END)                           AS new_users_30d,
        COUNT(t.id)                                                   AS total_transactions,
        COALESCE(SUM(t.amount),0)                                     AS total_volume,
        COALESCE(AVG(t.amount),0)                                     AS avg_transaction,
        COUNT(DISTINCT CASE WHEN t.transaction_date >= CURRENT_DATE - INTERVAL '7 days'
                            THEN t.user_id END)                      AS active_users_7d,
        COUNT(DISTINCT CASE WHEN t.transaction_date >= CURRENT_DATE - INTERVAL '30 days'
                            THEN t.user_id END)                      AS active_users_30d
      FROM users u
      LEFT JOIN transactions t ON u.id = t.user_id
      WHERE u.role = 'user'
    `);

    const catResult = await pool.query(`
      SELECT category, COUNT(*) AS tx_count, SUM(amount) AS total
      FROM transactions
      GROUP BY category ORDER BY total DESC LIMIT 5
    `);

    return res.json({
      success: true,
      summary: result.rows[0],
      topCategories: catResult.rows,
    });
  } catch (err) {
    console.error('[Analytics] getPlatformSummary:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.ANALYTICS_SUMMARY_FAILED });
  }
};

// ── GET /api/analytics/detailed  (superadmin only) ───────────────────────────
// Full breakdown including per-user activity ranges.
const getDetailedAnalytics = async (req, res) => {
  const { startDate, endDate } = req.query;
  if (startDate && !isValidDate(startDate)) return validationError(res, 'Invalid startDate.');
  if (endDate   && !isValidDate(endDate))   return validationError(res, 'Invalid endDate.');
  const from = startDate || new Date(Date.now() - 30*864e5).toISOString().slice(0,10);
  const to   = endDate   || new Date().toISOString().slice(0,10);

  try {
    const [volumeResult, cohortResult, categoryResult] = await Promise.all([
      pool.query(`
        SELECT DATE(transaction_date) AS date,
          COUNT(*) AS tx_count, SUM(amount) AS volume,
          COUNT(DISTINCT user_id) AS unique_users
        FROM transactions
        WHERE transaction_date BETWEEN $1 AND $2
        GROUP BY DATE(transaction_date) ORDER BY date
      `, [from, to]),

      pool.query(`
        SELECT DATE_TRUNC('month', u.created_at)::date AS cohort_month,
          COUNT(*) AS users_joined,
          COUNT(DISTINCT t.user_id) AS users_transacted
        FROM users u
        LEFT JOIN transactions t ON u.id = t.user_id AND t.transaction_date BETWEEN $1 AND $2
        WHERE u.role = 'user'
        GROUP BY cohort_month ORDER BY cohort_month
      `, [from, to]),

      pool.query(`
        SELECT category, COUNT(*) AS tx_count,
          SUM(amount) AS total, AVG(amount) AS avg_amount,
          COUNT(DISTINCT user_id) AS unique_users
        FROM transactions
        WHERE transaction_date BETWEEN $1 AND $2
        GROUP BY category ORDER BY total DESC
      `, [from, to]),
    ]);

    return res.json({
      success:         true,
      period:          { from, to },
      dailyVolume:     volumeResult.rows,
      userCohorts:     cohortResult.rows,
      categoryBreakdown: categoryResult.rows,
    });
  } catch (err) {
    console.error('[Analytics] getDetailedAnalytics:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.ANALYTICS_DETAILED_FAILED });
  }
};

export { getAnalytics, getSpendingTrendData, getTrendData,
  getPlatformSummary, getDetailedAnalytics, };