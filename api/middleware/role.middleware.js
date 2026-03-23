import { MESSAGES } from '../shared/constants/messages.js';

/**
 * authorizeRoles(...roles)
 * ------------------------
 * Factory that returns Express middleware restricting access
 * to one or more named roles.
 *
 * Usage:
 *   router.get('/path', verifyToken, authorizeRoles('admin','superadmin'), handler)
 *   router.get('/path', verifyToken, authorizeRoles('superadmin'), handler)
 */
const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: MESSAGES.FORBIDDEN });
  }
  next();
};

export { authorizeRoles };
