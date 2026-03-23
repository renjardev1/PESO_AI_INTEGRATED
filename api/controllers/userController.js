import pool from '../config/db.js';
import { HTTP, SAVINGS_DISTRIBUTION_COLORS } from '../constants/index.js';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const getUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.first_name, u.last_name, u.username, u.email,
        u.created_at, u.onboarding_completed, u.profile_picture,
        u.is_disabled,
        NULLIF(TRIM(u.profile_picture), '')          AS avatar_url,
        COALESCE(u.location, up.location, 'No Data') AS location,
        COALESCE(u.last_active_at, u.created_at)     AS last_active_at
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      LEFT JOIN notification_settings ns ON ns.user_id = u.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows || []);
  } catch (err) { console.error('[USERS ERROR]', err.message); res.json([]); }
};

export const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.first_name, u.last_name, u.username, u.email,
        u.created_at, u.onboarding_completed, u.profile_picture,
        u.is_disabled,
        NULLIF(TRIM(u.profile_picture), '')          AS avatar_url,
        COALESCE(u.location, up.location, 'No Data') AS location,
        COALESCE(u.last_active_at, u.created_at)     AS last_active_at,
        up.age, up.gender, up.occupation, up.monthly_income,
        up.monthly_expenses, up.financial_goals, up.risk_tolerance
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = $1
    `, [id]);
    if (!result.rows.length) return res.status(HTTP.NOT_FOUND).json({ message: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(HTTP.INTERNAL).json({ error: err.message }); }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { onboarding_completed, location } = req.body;
  const hasOnboarding = typeof onboarding_completed === 'boolean';
  const hasLocation   = typeof location === 'string';
  if (!hasOnboarding && !hasLocation)
    return res.status(HTTP.BAD_REQUEST).json({ message: 'No valid fields provided' });
  try {
    const result = await pool.query(
      `UPDATE users
       SET onboarding_completed = CASE WHEN $1::boolean THEN $2::boolean ELSE onboarding_completed END,
           location             = CASE WHEN $3::boolean THEN $4::text   ELSE location             END,
           last_active_at       = NOW()
       WHERE id = $5
       RETURNING id, first_name, last_name, onboarding_completed, location, last_active_at`,
      [hasOnboarding, Boolean(onboarding_completed), hasLocation, location ?? null, id]);
    if (!result.rows.length) return res.status(HTTP.NOT_FOUND).json({ message: 'User not found' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) { res.status(HTTP.INTERNAL).json({ error: err.message }); }
};

export const pingActive = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) { res.status(HTTP.INTERNAL).json({ error: err.message }); }
};

export const getUserAvatar = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id AS user_id, NULLIF(TRIM(profile_picture), '') AS avatar_url FROM users WHERE id = $1`, [id]);
    if (!result.rows.length) return res.status(HTTP.NOT_FOUND).json({ message: 'User not found' });
    return res.json(result.rows[0]);
  } catch (err) { return res.status(HTTP.INTERNAL).json({ error: err.message }); }
};

export const updateUserAvatar = async (req, res) => {
  const { id } = req.params;
  const { avatar_url } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET profile_picture = NULLIF($1::text,''), last_active_at = NOW()
       WHERE id = $2 RETURNING id AS user_id, NULLIF(TRIM(profile_picture),'') AS avatar_url`,
      [avatar_url ?? null, id]);
    if (!result.rows.length) return res.status(HTTP.NOT_FOUND).json({ message: 'User not found' });
    return res.json({ success: true, ...result.rows[0] });
  } catch (err) { return res.status(HTTP.INTERNAL).json({ error: err.message }); }
};

export const getKpis = async (req, res) => {
  try {
    const [userStats, financials] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) AS total_users,
          COUNT(CASE WHEN onboarding_completed = true THEN 1 END) AS active_users,
          ROUND(COUNT(CASE WHEN onboarding_completed = true THEN 1 END)::NUMERIC
            / NULLIF(COUNT(*),0)*100, 1) AS pct_active
        FROM users`),
      pool.query(`
        SELECT
          ROUND(AVG(COALESCE(inc.total,0)),2) AS avg_income,
          ROUND(AVG(COALESCE(exp.total,0)),2) AS avg_expenses,
          ROUND(AVG(COALESCE(inc.total,0)-COALESCE(exp.total,0)),2) AS avg_savings
        FROM users u
        LEFT JOIN notification_settings ns ON ns.user_id=u.id
        LEFT JOIN (SELECT user_id,SUM(amount) AS total FROM transactions
          WHERE transaction_type='income'
            AND EXTRACT(MONTH FROM transaction_date)=EXTRACT(MONTH FROM NOW())
            AND EXTRACT(YEAR  FROM transaction_date)=EXTRACT(YEAR  FROM NOW())
          GROUP BY user_id) inc ON inc.user_id=u.id
        LEFT JOIN (SELECT user_id,SUM(amount) AS total FROM transactions
          WHERE transaction_type='expense'
            AND EXTRACT(MONTH FROM transaction_date)=EXTRACT(MONTH FROM NOW())
            AND EXTRACT(YEAR  FROM transaction_date)=EXTRACT(YEAR  FROM NOW())
          GROUP BY user_id) exp ON exp.user_id=u.id
        WHERE COALESCE(ns.share_analytics, TRUE) = TRUE`),
    ]);
    const u = userStats.rows[0]; const f = financials.rows[0];
    res.json({
      total_users:  parseInt(u.total_users),
      active_users: parseInt(u.active_users),
      pct_active:   parseFloat(u.pct_active   || 0),
      avg_income:   parseFloat(f.avg_income   || 0),
      avg_expenses: parseFloat(f.avg_expenses || 0),
      avg_savings:  parseFloat(f.avg_savings  || 0),
    });
  } catch (err) { res.status(HTTP.INTERNAL).json({ error: err.message }); }
};

export const getTopCategories = async (req, res) => {
  try {
    const result = await pool.query(`
      WITH normalized AS (
        SELECT CASE
            WHEN LOWER(TRIM(category)) IN ('bills','bills & utilities') THEN 'Bills & Utilities'
            WHEN LOWER(TRIM(category)) IN ('transport','transportation') THEN 'Transportation'
            WHEN LOWER(TRIM(category)) IN ('food','food & dining') THEN 'Food & Dining'
            ELSE INITCAP(LOWER(TRIM(category)))
          END AS category, SUM(amount) AS total_spent
        FROM transactions WHERE transaction_type='expense'
        GROUP BY 1
      ),
      expense_cats AS (
        SELECT DISTINCT CASE
            WHEN LOWER(TRIM(name)) IN ('bills','bills & utilities') THEN 'Bills & Utilities'
            WHEN LOWER(TRIM(name)) IN ('transport','transportation') THEN 'Transportation'
            WHEN LOWER(TRIM(name)) IN ('food','food & dining') THEN 'Food & Dining'
            ELSE INITCAP(LOWER(TRIM(name)))
          END AS category
        FROM categories WHERE LOWER(TRIM(type))='expense'
      )
      SELECT c.category, COALESCE(t.total_spent,0) AS total_spent
      FROM expense_cats c LEFT JOIN normalized t ON t.category=c.category
      UNION
      SELECT t.category, t.total_spent FROM normalized t
      WHERE NOT EXISTS (SELECT 1 FROM expense_cats c WHERE c.category=t.category)
      ORDER BY total_spent DESC, category ASC
    `);
    res.json(result.rows || []);
  } catch (err) { res.status(HTTP.INTERNAL).json({ error: err.message }); }
};

export const getHighRisk = async (req, res) => {
  try {
    const { risk_level } = req.query;
    const result = await pool.query(`
      SELECT u.id AS user_id, u.first_name, u.last_name, u.email, u.profile_picture,
        NULLIF(TRIM(u.profile_picture),'') AS avatar_url,
        COALESCE(u.location, up.location,'No Data') AS location,
        COALESCE(u.last_active_at, u.created_at)    AS last_active_at,
        COALESCE(ROUND(inc.total,2),0) AS total_income,
        COALESCE(ROUND(exp.total,2),0) AS total_expenses,
        CASE WHEN COALESCE(inc.total,0)=0 THEN 0
             ELSE ROUND(COALESCE(exp.total,0)/inc.total*100,1) END AS expense_ratio,
        CASE WHEN COALESCE(inc.total,0)=0 THEN 'High'
             WHEN COALESCE(exp.total,0)/NULLIF(inc.total,0)>0.90 THEN 'High'
             WHEN COALESCE(exp.total,0)/NULLIF(inc.total,0)>0.60 THEN 'Medium'
             ELSE 'Low' END AS risk_level
      FROM users u
      LEFT JOIN notification_settings ns ON ns.user_id=u.id
      LEFT JOIN user_profiles up ON up.user_id=u.id
      LEFT JOIN (SELECT user_id,SUM(amount) AS total FROM transactions
        WHERE transaction_type='income'
          AND EXTRACT(MONTH FROM transaction_date)=EXTRACT(MONTH FROM NOW())
          AND EXTRACT(YEAR  FROM transaction_date)=EXTRACT(YEAR  FROM NOW())
        GROUP BY user_id) inc ON inc.user_id=u.id
      LEFT JOIN (SELECT user_id,SUM(amount) AS total FROM transactions
        WHERE transaction_type='expense'
          AND EXTRACT(MONTH FROM transaction_date)=EXTRACT(MONTH FROM NOW())
          AND EXTRACT(YEAR  FROM transaction_date)=EXTRACT(YEAR  FROM NOW())
        GROUP BY user_id) exp ON exp.user_id=u.id
      WHERE COALESCE(ns.share_analytics, true) = true
      ORDER BY expense_ratio DESC
    `);
    let rows = result.rows || [];
    if (risk_level && risk_level !== 'all') rows = rows.filter(r => r.risk_level === risk_level);
    res.json(rows);
  } catch (err) { res.status(HTTP.INTERNAL).json({ error: err.message }); }
};

export const getMonthlyTrend = async (req, res) => {
  const { period = 'monthly' } = req.query;
  try {
    if (period === 'daily') {
      const result = await pool.query(`
        SELECT day, ROUND(AVG(daily_income),2) AS avg_income, ROUND(AVG(daily_expenses),2) AS avg_expenses
        FROM (SELECT transaction_date::DATE AS day, user_id,
          SUM(CASE WHEN transaction_type='income'  THEN amount ELSE 0 END) AS daily_income,
          SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END) AS daily_expenses
          FROM transactions t2
          LEFT JOIN notification_settings ns ON ns.user_id = t2.user_id
          WHERE COALESCE(ns.share_analytics, true) = true
            AND t2.transaction_date::DATE >= DATE_TRUNC('month',CURRENT_DATE)::DATE
            AND t2.transaction_date::DATE <= CURRENT_DATE
          GROUP BY t2.transaction_date::DATE, t2.user_id) t
        GROUP BY day ORDER BY day`);
      return res.json(result.rows.map(r => {
        const d = new Date(r.day);
        return { label: MONTHS[d.getMonth()]+' '+d.getDate(),
          avg_income: parseFloat(r.avg_income||0), avg_expenses: parseFloat(r.avg_expenses||0),
          avg_savings: parseFloat((r.avg_income||0)-(r.avg_expenses||0)) };
      }));
    }
    if (period === 'weekly') {
      const result = await pool.query(`
        SELECT yr, wk, MIN(week_start) AS week_start,
          ROUND(AVG(weekly_income),2) AS avg_income, ROUND(AVG(weekly_expenses),2) AS avg_expenses
        FROM (SELECT EXTRACT(YEAR FROM transaction_date)::INT AS yr,
          EXTRACT(WEEK FROM transaction_date)::INT AS wk,
          DATE_TRUNC('week',transaction_date)::DATE AS week_start, user_id,
          SUM(CASE WHEN transaction_type='income'  THEN amount ELSE 0 END) AS weekly_income,
          SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END) AS weekly_expenses
          FROM transactions t2
          LEFT JOIN notification_settings ns ON ns.user_id = t2.user_id
          WHERE COALESCE(ns.share_analytics, true) = true
            AND t2.transaction_date >= DATE_TRUNC('week',CURRENT_DATE) - INTERVAL '7 weeks'
            AND t2.transaction_date <= CURRENT_DATE
          GROUP BY yr, wk, week_start, t2.user_id) t
        GROUP BY yr, wk ORDER BY yr, wk`);
      return res.json(result.rows.map(r => {
        const d = new Date(r.week_start);
        const e = new Date(d); e.setDate(e.getDate()+6);
        return { label: MONTHS[d.getMonth()]+' '+d.getDate(), week_start: r.week_start,
          week_end: e.toISOString().split('T')[0],
          avg_income: parseFloat(r.avg_income||0), avg_expenses: parseFloat(r.avg_expenses||0),
          avg_savings: parseFloat((r.avg_income||0)-(r.avg_expenses||0)) };
      }));
    }
    const result = await pool.query(`
      SELECT yr, mo, ROUND(AVG(monthly_income),2) AS avg_income, ROUND(AVG(monthly_expenses),2) AS avg_expenses
      FROM (SELECT EXTRACT(YEAR  FROM transaction_date)::INT AS yr,
        EXTRACT(MONTH FROM transaction_date)::INT AS mo, user_id,
        SUM(CASE WHEN transaction_type='income'  THEN amount ELSE 0 END) AS monthly_income,
        SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END) AS monthly_expenses
        FROM transactions
        WHERE transaction_date >= DATE_TRUNC('month',CURRENT_DATE) - INTERVAL '5 months'
          AND transaction_date <= CURRENT_DATE
          AND user_id IN (SELECT user_id FROM notification_settings WHERE share_analytics=TRUE)
        GROUP BY yr, mo, user_id) t
      GROUP BY yr, mo ORDER BY yr, mo`);
    return res.json(result.rows.map(r => ({
      label: MONTHS[r.mo-1]+' '+r.yr,
      avg_income: parseFloat(r.avg_income||0), avg_expenses: parseFloat(r.avg_expenses||0),
      avg_savings: parseFloat((r.avg_income||0)-(r.avg_expenses||0)),
    })));
  } catch (err) { res.status(HTTP.INTERNAL).json({ error: err.message }); }
};

export const getSavingsDistribution = async (req, res) => {
  const { period = 'monthly' } = req.query;
  try {
    const result = await pool.query(`
      SELECT
        COUNT(CASE WHEN net < 0                     THEN 1 END) AS deficit,
        COUNT(CASE WHEN net >= 0 AND ratio < 0.20   THEN 1 END) AS low,
        COUNT(CASE WHEN ratio BETWEEN 0.20 AND 0.50 THEN 1 END) AS moderate,
        COUNT(CASE WHEN ratio > 0.50                THEN 1 END) AS high
      FROM (
        SELECT user_id,
          SUM(CASE WHEN transaction_type='income'  THEN amount ELSE 0 END)
          - SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END) AS net,
          (SUM(CASE WHEN transaction_type='income'  THEN amount ELSE 0 END)
          - SUM(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END))
          / NULLIF(SUM(CASE WHEN transaction_type='income' THEN amount ELSE 0 END),0) AS ratio
        FROM transactions t
        LEFT JOIN notification_settings ns ON ns.user_id = t.user_id
        WHERE COALESCE(ns.share_analytics, true) = true
          AND (
          ($1::text='daily'   AND t.transaction_date >= NOW() - INTERVAL '13 days')
          OR ($1::text='weekly'  AND t.transaction_date >= NOW() - INTERVAL '7 weeks')
          OR ($1::text='monthly'
            AND EXTRACT(MONTH FROM t.transaction_date)=EXTRACT(MONTH FROM NOW())
            AND EXTRACT(YEAR  FROM t.transaction_date)=EXTRACT(YEAR  FROM NOW()))
        )
        GROUP BY t.user_id
      ) sub`, [period]);
    const r = result.rows[0];
    res.json([
      { name: 'Deficit',     value: parseInt(r.deficit ||0), color: SAVINGS_DISTRIBUTION_COLORS.DEFICIT  },
      { name: 'Low (<20%)',  value: parseInt(r.low     ||0), color: SAVINGS_DISTRIBUTION_COLORS.LOW      },
      { name: 'Moderate',    value: parseInt(r.moderate||0), color: SAVINGS_DISTRIBUTION_COLORS.MODERATE },
      { name: 'High (>50%)', value: parseInt(r.high    ||0), color: SAVINGS_DISTRIBUTION_COLORS.HIGH     },
    ]);
  } catch (err) { res.status(HTTP.INTERNAL).json({ error: err.message }); }
};