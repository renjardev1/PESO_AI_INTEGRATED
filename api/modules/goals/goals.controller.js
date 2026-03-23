import { createGoal, getAllGoalsByUser, getGoalById, updateGoal,
  addContribution, deleteGoal, getGoalProgress, } from '../../shared/models/savings_goal.model.js';
import pool from '../../config/db.js';
import { isPositiveNumber, isNonNegativeNumber, isNonEmptyString,
  isValidDate, isValidGoalStatus, sanitizeString, validationError, } from '../../shared/validators/index.js';
import { MESSAGES } from '../../shared/constants/messages.js';

// ─── POST /api/goals ─────────────────────────────────────────────────────────

const addGoal = async (req, res) => {
  const { userId, goalName, targetAmount, currentAmount = 0, deadline, category, icon, color } = req.body;

  if (!isNonEmptyString(goalName))    return validationError(res, 'Goal name is required.');
  if (!isPositiveNumber(targetAmount)) return validationError(res, 'Target amount must be a positive number.');
  if (!isNonNegativeNumber(currentAmount)) return validationError(res, 'Current amount must be non-negative.');
  if (deadline && !isValidDate(deadline)) return validationError(res, 'Deadline must be YYYY-MM-DD.');

  try {
    const goal = await createGoal(userId, {
      goal_name:      sanitizeString(goalName),
      target_amount:  parseFloat(targetAmount),
      current_amount: parseFloat(currentAmount),
      deadline:       deadline ? deadline.substring(0, 10) : null,
      category:       category || null,
      icon:           icon     || '🎯',
      color:          color    || '#2196F3',
    });
    return res.status(201).json({ success: true, goal });
  } catch (err) {
    console.error('[Goals] addGoal error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.GOAL_ADD_FAILED });
  }
};

// ─── GET /api/goals/:userId ───────────────────────────────────────────────────

const getUserGoals = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.query;

  if (status && !isValidGoalStatus(status)) {
    return validationError(res, 'Status must be active, completed, or paused.');
  }

  try {
    const goals = await getAllGoalsByUser(userId, status || null);
    return res.json({ success: true, goals });
  } catch (err) {
    console.error('[Goals] getUserGoals error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.GOAL_FETCH_FAILED });
  }
};

// ─── GET /api/goals/progress/:userId ─────────────────────────────────────────

const getUserProgress = async (req, res) => {
  const { userId } = req.params;
  try {
    const progress = await getGoalProgress(userId);
    return res.json({
      total_goals:      parseInt(progress.total_goals      || 0, 10),
      completed_goals:  parseInt(progress.completed_goals  || 0, 10),
      total_target:     parseFloat(progress.total_target   || 0),
      total_saved:      parseFloat(progress.total_saved    || 0),
      overall_progress: parseFloat(progress.overall_progress || 0),
    });
  } catch (err) {
    console.error('[Goals] getUserProgress error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.GOAL_FETCH_FAILED });
  }
};

// ─── GET /api/goals/:userId/:goalId ──────────────────────────────────────────

const getGoal = async (req, res) => {
  const { userId, goalId } = req.params;
  try {
    const goal = await getGoalById(parseInt(goalId, 10), userId);
    if (!goal) return res.status(404).json({ success: false, message: MESSAGES.GOAL_NOT_FOUND });
    return res.json({ success: true, goal });
  } catch (err) {
    console.error('[Goals] getGoal error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.GOAL_FETCH_FAILED });
  }
};

// ─── PUT /api/goals/:userId/:goalId ──────────────────────────────────────────

const editGoal = async (req, res) => {
  const { userId, goalId } = req.params;
  const { goalName, targetAmount, currentAmount, deadline, category, icon, color, status } = req.body;

  if (!isNonEmptyString(goalName))     return validationError(res, 'Goal name is required.');
  if (!isPositiveNumber(targetAmount)) return validationError(res, 'Target amount must be a positive number.');
  if (deadline && !isValidDate(deadline)) return validationError(res, 'Deadline must be YYYY-MM-DD.');
  if (status && !isValidGoalStatus(status)) return validationError(res, 'Status must be active, completed, or paused.');

  try {
    const goal = await updateGoal(parseInt(goalId, 10), userId, {
      goal_name:      sanitizeString(goalName),
      target_amount:  parseFloat(targetAmount),
      current_amount: parseFloat(currentAmount || 0),
      deadline:       deadline ? deadline.substring(0, 10) : null,
      category:       category || null,
      icon:           icon     || '🎯',
      color:          color    || '#2196F3',
      status:         status   || 'active',
    });
    if (!goal) return res.status(404).json({ success: false, message: MESSAGES.GOAL_NOT_FOUND });
    return res.json({ success: true, goal });
  } catch (err) {
    console.error('[Goals] editGoal error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.GOAL_UPDATE_FAILED });
  }
};

// ─── POST /api/goals/:userId/:goalId/contribute ───────────────────────────────

const contributeToGoal = async (req, res) => {
  const { userId, goalId } = req.params;
  const { amount, notes }  = req.body;

  if (!isPositiveNumber(amount)) return validationError(res, 'Contribution amount must be a positive number.');

  try {
    // ── NEW: Check if goal is already completed ─────────────────────────────
    const existingGoal = await getGoalById(parseInt(goalId, 10), userId);
    
    if (!existingGoal) {
      return res.status(404).json({ success: false, message: MESSAGES.GOAL_NOT_FOUND });
    }
    
    // Block contributions to completed goals
    if (existingGoal.status === 'completed') {
      return res.status(409).json({ 
        success: false, 
        message: 'This goal is already completed. No further contributions allowed.' 
      });
    }
    
    // Also block if already at or above target
    if (parseFloat(existingGoal.current_amount) >= parseFloat(existingGoal.target_amount)) {
      return res.status(409).json({ 
        success: false, 
        message: 'Goal has already reached its target amount. No further contributions allowed.' 
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const goal = await addContribution(parseInt(goalId, 10), userId, parseFloat(amount), notes || null);
    const message = goal.status === 'completed' ? MESSAGES.GOAL_COMPLETED : MESSAGES.GOAL_CONTRIBUTED;
    return res.json({ success: true, goal, message });
  } catch (err) {
    if (err.message === 'GOAL_NOT_FOUND') {
      return res.status(404).json({ success: false, message: MESSAGES.GOAL_NOT_FOUND });
    }
    console.error('[Goals] contributeToGoal error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.GOAL_CONTRIBUTE_FAILED });
  }
};

// ─── DELETE /api/goals/:userId/:goalId ───────────────────────────────────────

const removeGoal = async (req, res) => {
  const { userId, goalId } = req.params;
  try {
    const deleted = await deleteGoal(parseInt(goalId, 10), userId);
    if (!deleted) return res.status(404).json({ success: false, message: MESSAGES.GOAL_NOT_FOUND });
    return res.json({ success: true, message: MESSAGES.GOAL_DELETED });
  } catch (err) {
    console.error('[Goals] removeGoal error:', err.message);
    return res.status(500).json({ success: false, message: MESSAGES.GOAL_DELETE_FAILED });
  }
};

// ─── GET /api/goals/:userId/:goalId/contributions ────────────────────────────

const getGoalContributions = async (req, res) => {
  const { userId, goalId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  try {
    const goalCheck = await pool.query(
      'SELECT id FROM savings_goals WHERE id = $1 AND user_id = $2',
      [goalId, userId]
    );
    
    if (goalCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: MESSAGES.GOAL_NOT_FOUND 
      });
    }
    
    const [contributions, countResult] = await Promise.all([
      pool.query(
        `SELECT id, amount, contribution_date, notes, created_at
         FROM goal_contributions
         WHERE goal_id = $1 AND user_id = $2
         ORDER BY contribution_date DESC, created_at DESC
         LIMIT $3 OFFSET $4`,
        [goalId, userId, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) as total
         FROM goal_contributions
         WHERE goal_id = $1 AND user_id = $2`,
        [goalId, userId]
      )
    ]);
    
    return res.json({
      success: true,
      contributions: contributions.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
  } catch (err) {
    console.error('[Goals] getGoalContributions error:', err.message);
    return res.status(500).json({ 
      success: false, 
      message: MESSAGES.GOAL_FETCH_FAILED 
    });
  }
};

export { addGoal, getUserGoals, getUserProgress, getGoal, editGoal, contributeToGoal, removeGoal, getGoalContributions };