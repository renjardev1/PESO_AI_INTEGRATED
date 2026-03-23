// Double-submit cookie CSRF protection for web admin routes.
// Mobile routes are exempt — Bearer tokens are inherently CSRF-safe.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// All mobile user-facing paths are exempt: they use Bearer tokens, not cookies.
// Cookie-based web admin paths go through the CSRF check.
const EXEMPT_PATHS = new Set([
  '/api/auth/login', '/api/auth/refresh',
  // Mobile public routes
  '/api/login', '/api/signup', '/api/forgot-password',
  '/api/reset-password', '/api/onboarding',
  '/api/status', '/api/ai/health',
]);

export default function csrfMiddleware(req, res, next) {
  const method = (req.method || 'GET').toUpperCase();
  const path   = (req.path   || req.originalUrl || '').split('?')[0];

  if (SAFE_METHODS.has(method))  return next();
  if (EXEMPT_PATHS.has(path))    return next();

  // If the request carries a Bearer token it is not a browser-cookie request
  // and cannot be a CSRF attack — skip the check.
  if (req.headers.authorization?.startsWith('Bearer ')) return next();

  const headerToken = req.headers['x-csrf-token'];
  const cookieToken = req.cookies?.csrf_token;

  if (!headerToken || !cookieToken || headerToken !== cookieToken)
    return res.status(403).json({ error: 'Invalid CSRF token' });

  return next();
}
