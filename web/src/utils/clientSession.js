// pesir/src/utils/clientSession.js
// Session-safe client storage helpers and one-time localStorage sensitive-key migration.
const MIGRATION_FLAG = 'pesoai_sensitive_migration_v1';
const SENSITIVE_KEYS = ['token', 'currentUser', 'displayName', 'sessions'];

const getLegacyDisplayNameEntries = () => {
  const entries = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith('displayName_')) {
      entries.push([key, localStorage.getItem(key)]);
    }
  }
  return entries;
};

export const migrateSensitiveStorage = () => {
  sessionStorage.removeItem('currentUser');
  sessionStorage.removeItem('pesoai_sessions');
  sessionStorage.removeItem('pesoai_maint_kicks');
  localStorage.removeItem('pesoai_maint');
  localStorage.removeItem('pesoai_maint_until');
  localStorage.removeItem('pesoai_maint_trigger');
  localStorage.removeItem('pesoai_maint_kicks');

  if (localStorage.getItem(MIGRATION_FLAG) === 'done') return;

  getLegacyDisplayNameEntries().forEach(([key, value]) => {
    if (value != null && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, value);
    }
  });

  SENSITIVE_KEYS.forEach((key) => localStorage.removeItem(key));
  getLegacyDisplayNameEntries().forEach(([key]) => localStorage.removeItem(key));
  localStorage.setItem(MIGRATION_FLAG, 'done');
};

export const getCurrentUser = () => null;

export const setCurrentUser = () => {};

export const clearSensitiveSessionData = () => {
  Object.keys(sessionStorage).forEach((key) => {
    if (key.startsWith('displayName_')) sessionStorage.removeItem(key);
  });
};
