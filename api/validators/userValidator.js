import { body, param, query } from 'express-validator';
import { handleValidation } from '../middleware/validationMiddleware.js';

// Users table uses UUID — validate accordingly
export const validateUserIdParam = [
  param('id').isUUID().withMessage('User id must be a valid UUID'),
  handleValidation,
];

export const validateUpdateUser = [
  param('id').isUUID().withMessage('User id must be a valid UUID'),
  body('onboarding_completed').optional().isBoolean(),
  body('email').optional().trim().isEmail().normalizeEmail(),
  body('location').optional().trim()
    .isLength({ min: 2, max: 100 }).withMessage('location must be 2-100 characters').escape(),
  handleValidation,
];

export const validateUpdateUserAvatar = [
  param('id').isUUID().withMessage('User id must be a valid UUID'),
  body('avatar_url').optional({ nullable: true }).trim()
    .isLength({ max: 2000 }).withMessage('avatar_url must be at most 2000 characters')
    .custom((value) => {
      if (!value) return true;
      if (/^data:image\//i.test(value)) return true;
      try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol); }
      catch { return false; }
    }).withMessage('avatar_url must be a valid URL or data URI'),
  handleValidation,
];

export const validateRiskLevelQuery = [
  query('risk_level').optional().trim()
    .isIn(['all', 'High', 'Medium', 'Low']).withMessage('risk_level must be: all, High, Medium, or Low'),
  handleValidation,
];

export const validatePeriodQuery = [
  query('period').optional().trim()
    .isIn(['daily', 'weekly', 'monthly']).withMessage('period must be: daily, weekly, or monthly'),
  handleValidation,
];
