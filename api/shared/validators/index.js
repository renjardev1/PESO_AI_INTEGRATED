// =====================================================
// PESO AI — Input Validators
// Centralised, reusable validation functions used by
// all controllers to sanitise and enforce rules on
// incoming request data.
// =====================================================

const VALID_TRANSACTION_TYPES = ['expense'];
const VALID_STATUSES           = ['active', 'completed', 'paused'];
const VALID_BUDGET_PERIODS     = ['Daily', 'Weekly', 'Bi-monthly', 'Monthly'];
const VALID_RISK_TOLERANCES    = ['strict', 'balanced', 'flexible'];
const VALID_TREND_PERIODS      = ['week', 'month', 'year'];
const VALID_GENDERS            = ['male', 'female', 'non-binary', 'prefer not to say', 'other'];
const VALID_AI_MODES           = ['general', 'advanced'];

// ── CONFLICT FIX: kept for backwards-compat with existing controllers
//    that call normalizeCategory(value) with only one argument.
//    transaction_controller.js now passes a second arg (user's custom slugs).
const VALID_CATEGORIES = [
  'food & dining',
  'groceries',
  'transportation',
  'shopping',
  'entertainment',
  'health',
  'bills & utilities',
  'savings',
  'others',
];

// ─── Primitive Checks ────────────────────────────────────────────────────────

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveNumber(value) {
  const n = Number(value);
  return isFinite(n) && n > 0;
}

function isNonNegativeNumber(value) {
  const n = Number(value);
  return isFinite(n) && n >= 0;
}

function isValidUUID(value) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof value === 'string' && uuidRegex.test(value);
}

function isValidDate(value) {
  if (typeof value !== 'string') return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) return false;
  const d = new Date(value);
  return d instanceof Date && !isNaN(d.getTime());
}

function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value.trim());
}

function isValidIntId(value) {
  const n = parseInt(value, 10);
  return !isNaN(n) && n > 0;
}

// ─── Domain Checks ───────────────────────────────────────────────────────────

function isValidTransactionType(value) {
  return value === 'expense';
}

function isValidGoalStatus(value) {
  return VALID_STATUSES.includes(value);
}

function isValidBudgetPeriod(value) {
  return VALID_BUDGET_PERIODS.includes(value);
}

function isValidTrendPeriod(value) {
  return VALID_TREND_PERIODS.includes(value);
}

function isValidAIMode(value) {
  return VALID_AI_MODES.includes(value);
}

/**
 * Normalises a category string to lowercase and validates it.
 *
 * CONFLICT FIX — now accepts an optional second argument:
 *   extraCategories: string[]  — user's custom category slugs from DB
 *
 * Backwards compatible: all existing callers that pass only one argument
 * still work exactly as before (extraCategories defaults to []).
 *
 * Returns the normalised slug, or null if invalid.
 */
function normalizeCategory(value, extraCategories = []) {
  if (typeof value !== 'string') return null;
  const lower = value.trim().toLowerCase();
  if (VALID_CATEGORIES.includes(lower)) return lower;
  if (extraCategories.length > 0 && extraCategories.includes(lower)) return lower;
  return null;
}

// ─── Sanitisers ──────────────────────────────────────────────────────────────

function sanitizeString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeAmount(value) {
  const n = parseFloat(value);
  return isFinite(n) && n > 0 ? n : null;
}

function sanitizeInt(value) {
  const n = parseInt(value, 10);
  return !isNaN(n) ? n : null;
}

function sanitizeDate(value) {
  return isValidDate(value) ? value.trim() : null;
}

// ─── Convenience Builders ────────────────────────────────────────────────────

function validationError(res, errors) {
  return res.status(400).json({
    success: false,
    message: Array.isArray(errors) ? errors[0] : errors,
    errors:  Array.isArray(errors) ? errors : [errors],
  });
}

// ─── Pagination Helpers ──────────────────────────────────────────────────────

function parsePagination(query, defaultLimit = 50, maxLimit = 200) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export {
  // Constants
  VALID_TRANSACTION_TYPES,
  VALID_STATUSES,
  VALID_BUDGET_PERIODS,
  VALID_RISK_TOLERANCES,
  VALID_TREND_PERIODS,
  VALID_GENDERS,
  VALID_AI_MODES,
  VALID_CATEGORIES,

  // Checkers
  isNonEmptyString,
  isPositiveNumber,
  isNonNegativeNumber,
  isValidUUID,
  isValidDate,
  isValidEmail,
  isValidIntId,
  isValidTransactionType,
  isValidGoalStatus,
  isValidBudgetPeriod,
  isValidTrendPeriod,
  isValidAIMode,
  normalizeCategory,

  // Sanitisers
  sanitizeString,
  sanitizeAmount,
  sanitizeInt,
  sanitizeDate,

  // Helpers
  validationError,
  parsePagination,
};