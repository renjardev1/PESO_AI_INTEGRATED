import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../../config/db.js';
import { createUser, getUserByEmail, getUserByUsername, getUserById } from '../../shared/models/user.model.js';
import { createUserProfile, getUserProfile, updateUserProfile } from '../../shared/models/user_profile.model.js';
import { MESSAGES } from '../../shared/constants/messages.js';
import { sendPasswordResetOtp } from '../../shared/utils/mailer.js';
import { isNonEmptyString,
  isValidEmail,
  isPositiveNumber,
  isNonNegativeNumber,
  sanitizeString,
  validationError,
  VALID_RISK_TOLERANCES, } from '../../shared/validators/index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * REMEMBER ME FIX:
 * Regular login  → 1 day  token
 * Remember Me    → 7 day  token
 */
const buildToken = (userId, role, rememberMe = false) =>
  jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: rememberMe ? '7d' : (process.env.JWT_EXPIRY || '1d'),
  });

const buildUserPayload = (user) => ({
  id:                  user.id,
  firstName:           user.first_name,
  lastName:            user.last_name,
  username:            user.username,
  email:               user.email,
  onboardingCompleted: user.onboarding_completed || false,
});

// Generates a cryptographically random 6-digit OTP
const generateOtp = () =>
  String(crypto.randomInt(100000, 999999));

// ─── POST /api/signup ─────────────────────────────────────────────────────────

const signup = async (req, res) => {
  const { firstName, lastName, username, email, password } = req.body;

  const errors = [];
  if (!isNonEmptyString(firstName))  errors.push('First name is required.');
  if (!isNonEmptyString(lastName))   errors.push('Last name is required.');
  if (!isNonEmptyString(username))   errors.push('Username is required.');
  if (!isValidEmail(email))          errors.push('A valid email address is required.');
  if (!isNonEmptyString(password))   errors.push('Password is required.');
  else if (password.length < 6)      errors.push('Password must be at least 6 characters.');

  if (errors.length > 0) return validationError(res, errors);

  const cleanFirstName = sanitizeString(firstName);
  const cleanLastName  = sanitizeString(lastName);
  const cleanUsername  = sanitizeString(username).toLowerCase();
  const cleanEmail     = sanitizeString(email).toLowerCase();

  try {
    const existingEmail    = await getUserByEmail(cleanEmail);
    const existingUsername = await getUserByUsername(cleanUsername);

    if (existingEmail)    return res.status(409).json({ success: false, message: MESSAGES.AUTH_EMAIL_IN_USE });
    if (existingUsername) return res.status(409).json({ success: false, message: MESSAGES.AUTH_USERNAME_TAKEN });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user  = await createUser(cleanFirstName, cleanLastName, cleanUsername, cleanEmail, hashedPassword);
    const token = buildToken(user.id, user.role || 'user');

    return res.status(201).json({ success: true, user: buildUserPayload(user), token });

  } catch (err) {
    console.error('[Auth] signup error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.AUTH_CREATE_FAILED });
  }
};

// ─── POST /api/login ──────────────────────────────────────────────────────────

const login = async (req, res) => {
  // REMEMBER ME FIX: accept rememberMe flag from request body
  const { username, email, password, rememberMe = false } = req.body;

  if (!isNonEmptyString(password)) return validationError(res, 'Password is required.');
  if (!isNonEmptyString(username) && !isValidEmail(email)) {
    return validationError(res, 'Username or email is required.');
  }

  try {
    let user = null;
    if (isValidEmail(email))             user = await getUserByEmail(email.trim().toLowerCase());
    if (!user && isNonEmptyString(username)) user = await getUserByUsername(username.trim().toLowerCase());

    if (!user) return res.status(401).json({ success: false, message: MESSAGES.AUTH_INVALID_CREDENTIALS });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: MESSAGES.AUTH_INVALID_CREDENTIALS });

    // Disabled account check
    if (user.is_disabled) {
      return res.status(403).json({
        success: false, message: MESSAGES.AUTH_ACCOUNT_DISABLED,
        accountDisabled: true, reason: user.disabled_reason || null,
      });
    }

    const token = buildToken(user.id, user.role || 'user', rememberMe === true);

    return res.json({ success: true, user: buildUserPayload(user), token });

  } catch (err) {
    console.error('[Auth] login error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.AUTH_LOGIN_FAILED });
  }
};

// ─── POST /api/forgot-password ────────────────────────────────────────────────
// Step 1: User submits email → generate OTP → send email

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!isValidEmail(email)) return validationError(res, 'A valid email address is required.');

  try {
    const user = await getUserByEmail(email.trim().toLowerCase());

    // Always return success — never reveal whether email exists (security best practice)
    if (!user) {
      return res.json({ success: true, message: 'If that email is registered, a reset code has been sent.' });
    }

    // Invalidate any existing unused OTPs for this user
    await pool.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE',
      [user.id]
    );

    // Generate OTP and store with 15-minute expiry
    const otp       = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, otp, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, otp, expiresAt]
    );

    // Send OTP via Gmail
    await sendPasswordResetOtp(user.email, user.first_name, otp);

    return res.json({ success: true, message: 'If that email is registered, a reset code has been sent.' });

  } catch (err) {
    console.error('[Auth] forgotPassword error:', err.message);
    // Don't expose internal errors for this endpoint
    return res.json({ success: true, message: 'If that email is registered, a reset code has been sent.' });
  }
};

// ─── POST /api/reset-password ─────────────────────────────────────────────────
// Step 2: User submits email + OTP + new password

const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!isValidEmail(email))        return validationError(res, 'Email is required.');
  if (!isNonEmptyString(otp))      return validationError(res, 'Reset code is required.');
  if (!isNonEmptyString(newPassword) || newPassword.length < 6) {
    return validationError(res, 'New password must be at least 6 characters.');
  }

  try {
    const user = await getUserByEmail(email.trim().toLowerCase());
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });

    // Find the latest valid OTP for this user
    const result = await pool.query(
      `SELECT * FROM password_reset_tokens
       WHERE user_id = $1
         AND otp = $2
         AND used = FALSE
         AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id, otp.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
    }

    // Mark OTP as used
    await pool.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE id = $1',
      [result.rows[0].id]
    );

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, user.id]
    );

    return res.json({ success: true, message: 'Password reset successfully. Please log in.' });

  } catch (err) {
    console.error('[Auth] resetPassword error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
};

// ─── POST /api/onboarding ─────────────────────────────────────────────────────

const completeOnboarding = async (req, res) => {
  const {
    userId, age, gender, occupation,
    monthlyIncome,
    financialGoals, riskTolerance,
    savingsGoalAmount, categories,
  } = req.body;

  if (!isNonEmptyString(userId))     return validationError(res, 'User ID is required.');
  if (!isPositiveNumber(age))        return validationError(res, 'Valid age is required.');
  if (!isNonEmptyString(gender))     return validationError(res, 'Gender is required.');
  if (!isNonEmptyString(occupation)) return validationError(res, 'Occupation is required.');
  if (!isPositiveNumber(monthlyIncome)) return validationError(res, 'Monthly income must be a positive number.');
  if (!VALID_RISK_TOLERANCES.includes(riskTolerance)) {
    return validationError(res, `Risk tolerance must be one of: ${VALID_RISK_TOLERANCES.join(', ')}.`);
  }

  try {
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: MESSAGES.USER_NOT_FOUND });

    if (user.onboarding_completed) {
      return res.status(409).json({ success: false, message: MESSAGES.AUTH_ONBOARDING_ALREADY_DONE });
    }

    const existingProfile = await getUserProfile(userId);

    const profileData = {
      age:              parseInt(age, 10),
      gender:           gender.toLowerCase(),
      occupation:       sanitizeString(occupation),
      monthly_income:   parseFloat(monthlyIncome),
      financial_goals:  Array.isArray(financialGoals) ? financialGoals : [],
      risk_tolerance:   riskTolerance,
    };

    if (existingProfile) {
      await updateUserProfile(userId, profileData);
    } else {
      await createUserProfile(userId, profileData);
    }

    await pool.query(
      'UPDATE users SET onboarding_completed = TRUE WHERE id = $1',
      [userId]
    );

    return res.json({ success: true, message: MESSAGES.AUTH_ONBOARDING_SUCCESS });

  } catch (err) {
    console.error('[Auth] completeOnboarding error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.AUTH_ONBOARDING_FAILED });
  }
};

// ─── GET /api/profile/:userId ─────────────────────────────────────────────────

const getUserProfileData = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: MESSAGES.USER_NOT_FOUND });

    return res.json({ success: true, onboardingCompleted: user.onboarding_completed });

  } catch (err) {
    console.error('[Auth] getUserProfileData error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.SERVER_ERROR });
  }
};

export { signup, login, completeOnboarding, getUserProfileData,
  forgotPassword, resetPassword, };