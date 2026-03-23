// pesir/src/utils/EmergencyResume.js
// Global emergency maintenance-resume key listener for Main/Super Admin sessions.
import { apiFetch } from './authClient';

export const initEmergencyResume = () => {
  const onKeyDown = (e) => {
    if (!(e.shiftKey && e.altKey && e.key.toLowerCase() === 'r')) return;
    e.preventDefault();
    apiFetch('/api/auth/verify', { method: 'GET' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const role = data?.role;
        if (!(role === 'Super Admin' || role === 'Main Admin')) return;

        apiFetch('/api/maintenance', {
          method: 'POST',
          body: JSON.stringify({ active: false }),
        }).catch(() => {});

        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const bc = new BroadcastChannel('pesoai_maint');
            bc.postMessage({ active: false, endsAt: null });
            bc.close();
          } catch {
            // ignore BroadcastChannel errors
          }
        }

        window.location.reload();
      })
      .catch(() => {});
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
};
