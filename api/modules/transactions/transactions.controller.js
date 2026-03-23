import pool from '../../config/db.js';
import { createTransaction, getTransactionsByUser, countTransactionsByUser,
  getTransactionById, updateTransaction, deleteTransaction,
  getTransactionsByDateRange, getTotalsByCategory, getMonthlyTotals, } from '../../shared/models/transaction.model.js';
import { isPositiveNumber, isNonNegativeNumber, isValidDate, isNonEmptyString,
  isValidTransactionType, normalizeCategory, sanitizeString, sanitizeDate,
  validationError, parsePagination, } from '../../shared/validators/index.js';
import { MESSAGES } from '../../shared/constants/messages.js';
import { getCategorySlugs } from '../user/category.controller.js';
import { checkBudgetAlertsForUser } from '../user/notification.controller.js';

// ─── POST /api/transactions ───────────────────────────────────────────────────

const addTransaction = async (req, res) => {
  const { userId, amount, category, description, transactionType, transactionDate } = req.body;

  if (!isPositiveNumber(amount))           return validationError(res, 'Amount must be a positive number.');
  if (!isValidTransactionType(transactionType)) return validationError(res, 'Transaction type must be expense or income.');
  if (!isValidDate(transactionDate))       return validationError(res, 'Transaction date must be YYYY-MM-DD.');

  // FEATURE 3 FIX: load user's custom slugs so custom categories are accepted
  let extraSlugs = [];
  try { extraSlugs = await getCategorySlugs(userId); } catch (_) { /* non-fatal */ }

  const normCat = normalizeCategory(category, extraSlugs);
  if (!normCat) return validationError(res, `Invalid category. Valid: food & dining, groceries, transportation, shopping, entertainment, health, bills & utilities, savings, others — or any of your custom categories.`);

  try {
    const transaction = await createTransaction(userId, {
      amount:           parseFloat(amount),
      category:         normCat,
      description:      sanitizeString(description) || null,
      transaction_type: transactionType,
      transaction_date: transactionDate.substring(0, 10),
    });

    // Trigger budget alert check immediately after insert — best-effort,
    // never blocks or delays the transaction response
    checkBudgetAlertsForUser(userId).catch(err =>
        console.error('[Budget] Post-transaction alert check failed:', err.message)
    );

    return res.status(201).json({ success: true, transaction });
  } catch (err) {
    console.error('[Transaction] addTransaction error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.TRANSACTION_ADD_FAILED });
  }
};

// ─── GET /api/transactions/:userId ───────────────────────────────────────────

const getUserTransactions = async (req, res) => {
  const { userId }        = req.params;
  const { page, limit, offset } = parsePagination(req.query);

  try {
    const [transactions, total] = await Promise.all([
      getTransactionsByUser(userId, limit, offset),
      countTransactionsByUser(userId),
    ]);
    return res.json({ success: true, transactions, total, page, limit });
  } catch (err) {
    console.error('[Transaction] getUserTransactions error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.TRANSACTION_FETCH_FAILED });
  }
};

// ─── GET /api/transactions/:userId/:transactionId ────────────────────────────

const getTransaction = async (req, res) => {
  const { userId, transactionId } = req.params;
  try {
    const transaction = await getTransactionById(parseInt(transactionId, 10), userId);
    if (!transaction) return res.status(404).json({ success: false, message: MESSAGES.TRANSACTION_NOT_FOUND });
    return res.json({ success: true, transaction });
  } catch (err) {
    console.error('[Transaction] getTransaction error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.TRANSACTION_FETCH_FAILED });
  }
};

// ─── PUT /api/transactions/:userId/:transactionId ─────────────────────────────

const editTransaction = async (req, res) => {
  const { userId, transactionId } = req.params;
  const { amount, category, description, transactionType, transactionDate } = req.body;

  if (!isPositiveNumber(amount))           return validationError(res, 'Amount must be a positive number.');
  if (!isValidTransactionType(transactionType)) return validationError(res, 'Transaction type must be income or expense.');
  if (!isValidDate(transactionDate))       return validationError(res, 'Transaction date must be YYYY-MM-DD.');

  // FEATURE 3 FIX: load user's custom slugs so custom categories are accepted
  let extraSlugs = [];
  try { extraSlugs = await getCategorySlugs(userId); } catch (_) { /* non-fatal */ }

  const normCat = normalizeCategory(category, extraSlugs);
  if (!normCat) return validationError(res, 'Invalid category.');

  try {
    const transaction = await updateTransaction(parseInt(transactionId, 10), userId, {
      amount:           parseFloat(amount),
      category:         normCat,
      description:      sanitizeString(description) || null,
      transaction_type: transactionType,
      transaction_date: transactionDate.substring(0, 10),
    });
    if (!transaction) return res.status(404).json({ success: false, message: MESSAGES.TRANSACTION_NOT_FOUND });
    return res.json({ success: true, transaction });
  } catch (err) {
    console.error('[Transaction] editTransaction error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.TRANSACTION_UPDATE_FAILED });
  }
};

// ─── DELETE /api/transactions/:userId/:transactionId ─────────────────────────

const removeTransaction = async (req, res) => {
  const { userId, transactionId } = req.params;
  try {
    const deleted = await deleteTransaction(parseInt(transactionId, 10), userId);
    if (!deleted) return res.status(404).json({ success: false, message: MESSAGES.TRANSACTION_NOT_FOUND });
    return res.json({ success: true, message: MESSAGES.TRANSACTION_DELETED });
  } catch (err) {
    console.error('[Transaction] removeTransaction error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.TRANSACTION_DELETE_FAILED });
  }
};

// ─── GET /api/transactions/:userId/range ─────────────────────────────────────

const getTransactionsByRange = async (req, res) => {
  const { userId }              = req.params;
  const { startDate, endDate }  = req.query;

  if (!isValidDate(startDate)) return validationError(res, 'Start date is required (YYYY-MM-DD).');
  if (!isValidDate(endDate))   return validationError(res, 'End date is required (YYYY-MM-DD).');

  try {
    const transactions = await getTransactionsByDateRange(userId, startDate, endDate);
    return res.json({ success: true, transactions });
  } catch (err) {
    console.error('[Transaction] getTransactionsByRange error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.TRANSACTION_FETCH_FAILED });
  }
};

// ─── GET /api/transactions/:userId/summary/category ──────────────────────────

const getCategorySummary = async (req, res) => {
  const { userId }             = req.params;
  const { startDate, endDate } = req.query;

  if (!isValidDate(startDate)) return validationError(res, 'Start date is required.');
  if (!isValidDate(endDate))   return validationError(res, 'End date is required.');

  try {
    const summary = await getTotalsByCategory(userId, startDate, endDate);
    return res.json({ success: true, summary });
  } catch (err) {
    console.error('[Transaction] getCategorySummary error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.TRANSACTION_FETCH_FAILED });
  }
};

// ─── GET /api/transactions/:userId/summary/monthly ───────────────────────────

const getMonthlySummary = async (req, res) => {
  const { userId } = req.params;
  const now = new Date();

  try {
    // Income comes from user_profiles.monthly_income (transactions only store expenses)
    const [rows, profileResult] = await Promise.all([
      getMonthlyTotals(userId, now.getFullYear(), now.getMonth() + 1),
      pool.query('SELECT monthly_income FROM user_profiles WHERE user_id = $1', [userId]),
    ]);

    const income   = parseFloat(profileResult.rows[0]?.monthly_income || 0);
    const expenses = parseFloat(rows.find(r => r.transaction_type === 'expense')?.total || 0);
    return res.json({ success: true, income, expenses, balance: income - expenses });
  } catch (err) {
    console.error('[Transaction] getMonthlySummary error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.TRANSACTION_FETCH_FAILED });
  }
};

export { addTransaction, getUserTransactions, getTransaction, editTransaction,
  removeTransaction, getTransactionsByRange, getCategorySummary, getMonthlySummary, };