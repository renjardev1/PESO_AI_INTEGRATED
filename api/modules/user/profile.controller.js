import bcrypt from 'bcryptjs';
import pool from '../../config/db.js';
import { isNonEmptyString, isValidEmail, isPositiveNumber,
  isNonNegativeNumber, sanitizeString, validationError,
  VALID_BUDGET_PERIODS, VALID_RISK_TOLERANCES, } from '../../shared/validators/index.js';
import { MESSAGES } from '../../shared/constants/messages.js';

// ─── GET /api/profile/:userId ─────────────────────────────────────────────────

const getProfile = async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        u.id, u.first_name, u.last_name, u.email, u.username,
        u.profile_picture, u.created_at,
        p.age, p.gender, p.occupation,
        p.monthly_income, p.monthly_expenses,
        COALESCE(p.phone, u.phone)         AS phone,
        COALESCE(p.location, u.location)     AS location,
        p.financial_goals, p.risk_tolerance,
        COALESCE(CURRENT_DATE - u.created_at::date, 0) AS days_active
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: MESSAGES.USER_NOT_FOUND });
    }

    const user = result.rows[0];

    // Ensure a user_profiles row exists — creates a skeleton if onboarding was skipped
    // This prevents phone/location saves from silently failing
    await pool.query(
      `INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    const [goalsResult, completedResult, savedResult] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM savings_goals WHERE user_id = $1', [userId]),
      pool.query("SELECT COUNT(*) AS count FROM savings_goals WHERE user_id = $1 AND status = 'completed'", [userId]),
      pool.query('SELECT COALESCE(SUM(current_amount), 0) AS total_saved FROM savings_goals WHERE user_id = $1', [userId]),
    ]);

    return res.json({
      success: true,
      profile: {
        name:            `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        firstName:       user.first_name,
        lastName:        user.last_name,
        email:           user.email,
        username:        user.username,
        profilePicture:  user.profile_picture || null,
        phone:           user.phone    || null,
        location:        user.location || null,
        age:             user.age      || 0,
        gender:          user.gender   || '',
        occupation:      user.occupation || '',
        monthlyIncome:   parseFloat(user.monthly_income  || 0),
        monthlyExpenses: parseFloat(user.monthly_expenses || 0),
        financialGoals:  user.financial_goals || [],
        riskTolerance:   user.risk_tolerance  || '',
        daysActive:      parseInt(user.days_active || 0, 10),
        goalsCount:      parseInt(goalsResult.rows[0].count    || 0, 10),
        completedGoals:  parseInt(completedResult.rows[0].count || 0, 10),
        totalSaved:      parseFloat(savedResult.rows[0].total_saved || 0),
        createdAt:       user.created_at,
      },
    });

  } catch (err) {
    console.error('[Profile] getProfile error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.PROFILE_UPDATE_FAILED });
  }
};

// ─── PUT /api/profile/:userId ─────────────────────────────────────────────────

const updateProfile = async (req, res) => {
  const { userId } = req.params;
  const { firstName, lastName, email, username, phone, location, riskTolerance } = req.body;

  if (email         !== undefined && !isValidEmail(email))                          return validationError(res, 'Invalid email address.');
  if (firstName     !== undefined && !isNonEmptyString(firstName))                  return validationError(res, 'First name cannot be blank.');
  if (lastName      !== undefined && !isNonEmptyString(lastName))                   return validationError(res, 'Last name cannot be blank.');
  if (username      !== undefined && !isNonEmptyString(username))                   return validationError(res, 'Username cannot be blank.');
  if (riskTolerance !== undefined && !VALID_RISK_TOLERANCES.includes(riskTolerance))
    return validationError(res, `Risk tolerance must be one of: ${VALID_RISK_TOLERANCES.join(', ')}.`);

  try {
    if (email) {
      const check = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [sanitizeString(email).toLowerCase(), userId]);
      if (check.rows.length > 0) return res.status(409).json({ success: false, message: MESSAGES.AUTH_EMAIL_IN_USE });
    }
    if (username) {
      const check = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [sanitizeString(username).toLowerCase(), userId]);
      if (check.rows.length > 0) return res.status(409).json({ success: false, message: MESSAGES.AUTH_USERNAME_TAKEN });
    }

    const updates = [];
    const values  = [];
    let idx = 1;

    if (firstName !== undefined) { updates.push(`first_name = $${idx++}`); values.push(sanitizeString(firstName)); }
    if (lastName  !== undefined) { updates.push(`last_name = $${idx++}`);  values.push(sanitizeString(lastName)); }
    if (email     !== undefined) { updates.push(`email = $${idx++}`);      values.push(sanitizeString(email).toLowerCase()); }
    if (username  !== undefined) { updates.push(`username = $${idx++}`);   values.push(sanitizeString(username).toLowerCase()); }

    if (updates.length > 0) {
      values.push(userId);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    }

    // Mirror location + phone to users table (fallback for getProfile COALESCE)
    if (location !== undefined) {
      await pool.query('UPDATE users SET location = $1 WHERE id = $2', [location || null, userId]);
    }
    if (phone !== undefined) {
      await pool.query('UPDATE users SET phone = $1 WHERE id = $2', [phone || null, userId]);
    }

    // Build user_profiles update — phone, location, and/or riskTolerance
    const profileUpdates = [];
    const profileValues  = [userId];
    let pidx = 2;

    if (phone         !== undefined) { profileUpdates.push(`phone          = $${pidx++}`); profileValues.push(phone         || null); }
    if (location      !== undefined) { profileUpdates.push(`location       = $${pidx++}`); profileValues.push(location      || null); }
    if (riskTolerance !== undefined) { profileUpdates.push(`risk_tolerance = $${pidx++}`); profileValues.push(riskTolerance); }

    if (profileUpdates.length > 0) {
      // UPSERT — creates the row if onboarding somehow skipped it
      const cols = profileUpdates.map(u => u.split(' = ')[0].trim());
      await pool.query(
        `INSERT INTO user_profiles (user_id, ${cols.join(', ')})
         VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')})
         ON CONFLICT (user_id) DO UPDATE SET
           ${profileUpdates.join(', ')},
           updated_at = CURRENT_TIMESTAMP`,
        profileValues
      );
    }

    return res.json({ success: true, message: MESSAGES.PROFILE_UPDATE_SUCCESS });
  } catch (err) {
    console.error('[Profile] updateProfile error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.PROFILE_UPDATE_FAILED });
  }
};

// ─── PUT /api/profile/:userId/picture ────────────────────────────────────────

const uploadProfilePicture = async (req, res) => {
  const { userId }        = req.params;
  const { profilePicture } = req.body;

  if (!isNonEmptyString(profilePicture) || !profilePicture.startsWith('data:image/')) {
    return validationError(res, MESSAGES.PROFILE_PICTURE_INVALID);
  }

  try {
    await pool.query('UPDATE users SET profile_picture = $1 WHERE id = $2', [profilePicture, userId]);
    return res.json({ success: true, message: MESSAGES.PROFILE_PICTURE_UPDATED, profilePicture });
  } catch (err) {
    console.error('[Profile] uploadProfilePicture error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.PROFILE_UPDATE_FAILED });
  }
};

// ─── PUT /api/profile/:userId/budget ─────────────────────────────────────────

const updateBudget = async (req, res) => {
  const { userId }         = req.params;
  const { monthlyExpenses } = req.body;

  if (!isNonNegativeNumber(monthlyExpenses)) {
    return validationError(res, 'Monthly expenses must be a non-negative number.');
  }

  try {
    // ✅ Update BOTH monthly_expenses AND monthly_income to keep them in sync
    await pool.query(
      'UPDATE user_profiles SET monthly_expenses = $1, monthly_income = $1 WHERE user_id = $2',
      [parseFloat(monthlyExpenses), userId]
    );
    return res.json({ success: true, message: MESSAGES.PROFILE_BUDGET_UPDATED, monthlyExpenses: parseFloat(monthlyExpenses) });
  } catch (err) {
    console.error('[Profile] updateBudget error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.PROFILE_UPDATE_FAILED });
  }
};

// ─── PUT /api/profile/:userId/budget-period ──────────────────────────────────

const updateBudgetPeriod = async (req, res) => {
  const { userId }     = req.params;
  const { budgetPeriod } = req.body;

  if (!VALID_BUDGET_PERIODS.includes(budgetPeriod)) {
    return validationError(res, `Budget period must be one of: ${VALID_BUDGET_PERIODS.join(', ')}.`);
  }

  try {
    await pool.query(
      'UPDATE user_profiles SET budget_period = $1 WHERE user_id = $2',
      [budgetPeriod, userId]
    );
    return res.json({ success: true, message: MESSAGES.PROFILE_BUDGET_PERIOD_UPDATED, budgetPeriod });
  } catch (err) {
    console.error('[Profile] updateBudgetPeriod error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.PROFILE_UPDATE_FAILED });
  }
};

// ─── PUT /api/profile/:userId/password ───────────────────────────────────────

const changePassword = async (req, res) => {
  const { userId }              = req.params;
  const { oldPassword, newPassword } = req.body;

  if (!isNonEmptyString(oldPassword)) return validationError(res, 'Current password is required.');
  if (!isNonEmptyString(newPassword)) return validationError(res, 'New password is required.');
  if (newPassword.length < 6)         return validationError(res, 'New password must be at least 6 characters.');

  try {
    const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: MESSAGES.USER_NOT_FOUND });

    const isMatch = await bcrypt.compare(oldPassword, result.rows[0].password);
    if (!isMatch) return res.status(401).json({ success: false, message: MESSAGES.PROFILE_WRONG_PASSWORD });

    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, userId]);

    return res.json({ success: true, message: MESSAGES.PROFILE_PASSWORD_CHANGED });
  } catch (err) {
    console.error('[Profile] changePassword error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.PROFILE_UPDATE_FAILED });
  }
};

// ─── DELETE /api/profile/:userId ─────────────────────────────────────────────

const deleteAccount = async (req, res) => {
  const { userId }   = req.params;
  const { password } = req.body;

  if (!isNonEmptyString(password)) return validationError(res, 'Password is required.');

  try {
    const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: MESSAGES.USER_NOT_FOUND });

    const isMatch = await bcrypt.compare(password, result.rows[0].password);
    if (!isMatch) return res.status(401).json({ success: false, message: MESSAGES.PROFILE_WRONG_PASSWORD });

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    return res.json({ success: true, message: MESSAGES.AUTH_ACCOUNT_DELETED });
  } catch (err) {
    console.error('[Profile] deleteAccount error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.PROFILE_DELETE_FAILED });
  }
};

export { getProfile, updateProfile, uploadProfilePicture,
  updateBudget, updateBudgetPeriod, changePassword, deleteAccount, };