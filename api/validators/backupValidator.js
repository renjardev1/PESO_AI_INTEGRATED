import { body } from 'express-validator';
import { handleValidation } from '../middleware/validationMiddleware.js';

export const validateRestoreBackup = [
  body('filename').optional({ nullable: true }).trim()
    .matches(/^[A-Za-z0-9._() -]+$/).withMessage('filename contains invalid characters'),
  body('uploadedFile.name').optional({ nullable: true })
    .isString().withMessage('uploadedFile.name must be a string'),
  body('uploadedFile.content').optional({ nullable: true })
    .isString().withMessage('uploadedFile.content must be a string'),
  body().custom((value) => {
    if (value?.filename || value?.uploadedFile?.content) return true;
    throw new Error('filename or uploadedFile is required');
  }),
  handleValidation,
];
