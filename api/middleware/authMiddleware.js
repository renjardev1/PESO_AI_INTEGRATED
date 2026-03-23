// api/middleware/authMiddleware.js
// Verifies access JWT strictly from HttpOnly cookie `token`.
import { HTTP } from '../constants/index.js';
import { verifyAccessToken } from '../utils/tokenService.js';
import { sendError } from '../utils/apiResponse.js';

export const verifyToken = (req, res, next) => {
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : null;
  const token = bearerToken || req.cookies?.token;
  if (!token) {
    return sendError(res, HTTP.UNAUTHORIZED, 'No authentication token provided');
  }

  try {
    const decoded = verifyAccessToken(token);
    req.admin = { id: decoded.id, name: decoded.name, role: decoded.role };
    req.authMode = bearerToken ? 'bearer' : 'cookie';
    return next();
  } catch {
    return sendError(res, HTTP.UNAUTHORIZED, 'Invalid or expired token');
  }
};
