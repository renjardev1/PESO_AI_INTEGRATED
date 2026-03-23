// pesir/src/utils/authClient.js
// Cookie-aware fetch wrapper with automatic refresh retry for protected endpoints.
const API_BASE = '';
let csrfToken = null;

const isSafeMethod = (method = 'GET') => ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

const getRequestMethod = (options = {}) => (options.method || 'GET').toUpperCase();

const mergeHeaders = (headers = {}) => {
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  return { ...headers };
};

const withDefaults = (options = {}) => {
  const mergedHeaders = mergeHeaders(options.headers);
  return {
    credentials: 'include',
    ...options,
    headers: mergedHeaders,
  };
};

const isJsonRequest = (options = {}) =>
  options.body && typeof options.body === 'string' && !options.headers?.['Content-Type'];

const shouldAutoRefreshSession = (path = '') =>
  !path.includes('/api/auth/login') &&
  !path.includes('/api/auth/refresh') &&
  !path.includes('/api/auth/csrf-token');

export const refreshCsrfToken = async () => {
  try {
    const res = await fetch('/api/auth/csrf-token', {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    csrfToken = data.csrfToken || null;
    return csrfToken;
  } catch {
    return null;
  }
};

export const clearCsrfToken = () => {
  csrfToken = null;
};

export const apiFetch = async (path, options = {}, retry = true) => {
  const init = withDefaults(options);
  const method = getRequestMethod(init);

  if (isJsonRequest(init)) {
    init.headers['Content-Type'] = 'application/json';
  }
  if (!isSafeMethod(method) && csrfToken) {
    init.headers['x-csrf-token'] = csrfToken;
  }

  const response = await fetch(path.startsWith('http') ? path : `${API_BASE}${path}`, init);
  if (response.ok) {
    if (path.includes('/api/auth/login')) {
      await refreshCsrfToken();
    } else if (path.includes('/api/auth/refresh')) {
      await refreshCsrfToken();
    } else if (path.includes('/api/auth/logout')) {
      clearCsrfToken();
    }
    return response;
  }

  if (response.status !== 401 || !retry || !shouldAutoRefreshSession(path)) return response;

  const refreshResponse = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!refreshResponse.ok) return response;

  await refreshCsrfToken();

  return apiFetch(path, options, false);
};
