import { body } from 'express-validator';
import { handleValidation } from '../middleware/validationMiddleware.js';

export const validateSetMaintenance = [
  body('active').isBoolean().withMessage('active must be boolean'),
  body('endsAt').optional({ nullable: true })
    .isInt({ min: 0 }).withMessage('endsAt must be a positive timestamp').toInt(),
  handleValidation,
];
