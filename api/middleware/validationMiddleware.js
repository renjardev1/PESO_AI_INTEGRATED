import { validationResult } from 'express-validator';
import { sendError } from '../utils/apiResponse.js';

export const handleValidation = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  return sendError(res, 422, 'Validation failed',
    result.array().map((e) => ({ field: e.path, message: e.msg, value: e.value })));
};
