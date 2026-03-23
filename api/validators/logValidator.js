import { body } from 'express-validator';
import { handleValidation } from '../middleware/validationMiddleware.js';
import { LOG_TYPES } from '../constants/index.js';

export const validateCreateLog = [
  body('type').trim()
    .isIn(Object.values(LOG_TYPES)).withMessage(`type must be one of: ${Object.values(LOG_TYPES).join(', ')}`),
  body('user_name').trim().notEmpty()
    .isLength({ min: 2, max: 100 }).withMessage('user_name must be 2-100 characters').escape(),
  body('message').trim().notEmpty()
    .isLength({ min: 3, max: 400 }).withMessage('message must be 3-400 characters').escape(),
  handleValidation,
];
