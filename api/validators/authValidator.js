import { body, param } from 'express-validator';
import { handleValidation } from '../middleware/validationMiddleware.js';
import { ROLES } from '../constants/index.js';

const passwordRules = (field) =>
  body(field)
    .isString().withMessage('Password must be a string')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must include an uppercase letter')
    .matches(/\d/).withMessage('Password must include a number')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must include a symbol');

export const validateLogin = [
  body('username').trim().notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 100 }).withMessage('Username must be 3-100 characters').escape(),
  body('password').isString().notEmpty().withMessage('Password is required'),
  handleValidation,
];

export const validateChangePassword = [
  body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
  passwordRules('newPassword'),
  handleValidation,
];

export const validateAvatar = [
  body('avatar').isString().notEmpty()
    .custom((v) => v.startsWith('data:image/')).withMessage('Avatar must be an image data URL')
    .isLength({ max: 2_800_000 }).withMessage('Avatar image is too large'),
  handleValidation,
];

export const validateDisplayName = [
  body('displayName').trim().notEmpty()
    .isLength({ min: 2, max: 100 }).withMessage('displayName must be 2-100 characters').escape(),
  handleValidation,
];

export const validateCreateAdmin = [
  body('username').trim().notEmpty()
    .isLength({ min: 3, max: 100 }).withMessage('Username must be 3-100 characters').escape(),
  passwordRules('password'),
  body('role').trim()
    .isIn(Object.values(ROLES)).withMessage(`Role must be one of: ${Object.values(ROLES).join(', ')}`),
  handleValidation,
];

export const validateDeleteAdmin = [
  param('id').isInt({ min: 1 }).withMessage('Admin id must be a positive integer').toInt(),
  handleValidation,
];

export const validateAuditLog = [
  body('action').trim().notEmpty()
    .isLength({ min: 3, max: 300 }).withMessage('action must be 3-300 characters').escape(),
  body('target_type').optional().trim()
    .isLength({ min: 2, max: 50 }).withMessage('target_type must be 2-50 characters').escape(),
  handleValidation,
];
