// Verifies JWT from HttpOnly cookie OR Bearer header.
// Sets req.admin = { id, name, role }  (web admin session)
// Used by /api/auth/* and /api/admin/* and /api/superadmin/* routes.
import { HTTP } from '../constants/index.js';
import { verifyAccessToken } from '../utils/tokenService.js';
import { sendError } from '../utils/apiResponse.js';

export const verifyAdmin = (req, res, next) => {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : null;
  const token = bearer || req.cookies?.token;
  if (!token) return sendError(res, HTTP.UNAUTHORIZED, 'No authentication token provided');
  try {
    const decoded = verifyAccessToken(token);
    req.admin = { id: decoded.id, name: decoded.name, role: decoded.role };
    return next();
  } catch {
    return sendError(res, HTTP.UNAUTHORIZED, 'Invalid or expired token');
  }
};

// Role guard for web admin routes.
// MAIN_ADMIN can do everything STAFF_ADMIN can, plus more.
// Usage: requireAdminRole('Main Admin')  or  requireAdminRole('Staff Admin', 'Main Admin')
export const requireAdminRole = (...roles) => (req, res, next) => {
  if (!req.admin || !roles.includes(req.admin.role)) {
    return sendError(res, HTTP.FORBIDDEN, 'Insufficient permissions');
  }
  next();
};
