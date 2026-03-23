import pool from '../../config/db.js';
import { getUserProfile } from '../../shared/models/user_profile.model.js';
import { getUserById } from '../../shared/models/user.model.js';
import { MESSAGES } from '../../shared/constants/messages.js';

const CATEGORY_META = {
  'food & dining':    { icon: '🍔', color: '#FF9800' },
  'groceries':        { icon: '🛒', color: '#E91E63' },
  'transportation':   { icon: '🚗', color: '#F44336' },
  'shopping':         { icon: '🛍️', color: '#9C27B0' },
  'entertainment':    { icon: '🎬', color: '#3F51B5' },
  'health':           { icon: '⚕️', color: '#4CAF50' },
  'bills & utilities':{ icon: '📄', color: '#FF5722' },
  'savings':          { icon: '💰', color: '#2196F3' },
  'others':           { icon: '💵', color: '#607D8B' },
};

const getCategoryMeta = (category = '') =>
  CATEGORY_META[category.toLowerCase()] || { icon: '💵', color: '#607D8B' };

// ─── GET /api/dashboard/:userId ───────────────────────────────────────────────

const getDashboard = async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(`
      WITH monthly_data AS (
        SELECT
          COALESCE(SUM(amount), 0) AS total_spent
        FROM transactions
        WHERE user_id = $1
          AND transaction_type = 'expense'
          AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)
      ),
      user_budget AS (
        SELECT
          COALESCE(monthly_income, 0) AS monthly_income
        FROM user_profiles
        WHERE user_id = $1
      )
      SELECT
        ub.monthly_income,
        md.total_spent,
        (ub.monthly_income - md.total_spent) AS remaining
      FROM user_budget ub
      CROSS JOIN monthly_data md
    `, [userId]);

    if (result.rows.length === 0) {
      return res.json({ success: true, monthlyIncome: 0, totalSpent: 0, remaining: 0 });
    }

    const d = result.rows[0];
    return res.json({
      success:      true,
      monthlyIncome: parseFloat(d.monthly_income || 0),
      totalSpent:   parseFloat(d.total_spent    || 0),
      remaining:    parseFloat(d.remaining      || 0),
    });

  } catch (err) {
    console.error('[Dashboard] getDashboard error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.DASHBOARD_FETCH_FAILED });
  }
};

// ─── GET /api/dashboard/:userId/profile ──────────────────────────────────────

const getFullProfile = async (req, res) => {
  const { userId } = req.params;

  try {
    const [user, profile] = await Promise.all([
      getUserById(userId),
      getUserProfile(userId),
    ]);

    if (!user || !profile) {
      return res.status(404).json({ success: false, message: MESSAGES.USER_NOT_FOUND });
    }

    const daysActive = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));

    let financialGoals = [];
    try {
      financialGoals = typeof profile.financial_goals === 'string'
        ? JSON.parse(profile.financial_goals)
        : profile.financial_goals || [];
    } catch { financialGoals = []; }

    return res.json({
      success:         true,
      firstName:       user.first_name,
      lastName:        user.last_name,
      username:        user.username,
      email:           user.email,
      age:             profile.age,
      gender:          profile.gender,
      occupation:      profile.occupation,
      monthlyIncome:   parseFloat(profile.monthly_income  || 0),
      monthlyExpenses: parseFloat(profile.monthly_expenses || 0),
      financialGoals,
      riskTolerance:   profile.risk_tolerance,
      daysActive,
      goalsCount:      financialGoals.length,
    });

  } catch (err) {
    console.error('[Dashboard] getFullProfile error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.DASHBOARD_FETCH_FAILED });
  }
};

export { getDashboard, getFullProfile };
export { getDashboard as getDashboardData };