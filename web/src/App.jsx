// pesir/src/App.jsx
// Root app routes with cookie-based auth verification and one-time sensitive storage cleanup.
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { initEmergencyResume } from './utils/EmergencyResume';
import { apiFetch, refreshCsrfToken } from './utils/authClient';
import { migrateSensitiveStorage, clearSensitiveSessionData } from './utils/clientSession';

import LandingPage from './pages/LandingPage';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';

const ProtectedRoute = ({ children }) => {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    const verify = async () => {
      try {
        const response = await apiFetch('/api/auth/verify', { method: 'GET' });
        if (!response.ok) {
          clearSensitiveSessionData();
          setStatus('invalid');
          return;
        }
        setStatus('valid');
      } catch {
        clearSensitiveSessionData();
        setStatus('invalid');
      }
    };

    verify();
  }, []);

  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F0F4FF]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Verifying session...</p>
        </div>
      </div>
    );
  }

  return status === 'valid' ? children : <Navigate to="/" replace />;
};

function App() {
  useEffect(() => {
    migrateSensitiveStorage();
    refreshCsrfToken();
    const cleanup = initEmergencyResume();
    return () => cleanup && cleanup();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey && e.shiftKey && e.altKey && e.key.toLowerCase() === 'u')) return;
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
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LandingPage />} />

        <Route
          path="/admin"
          element={(
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          )}
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UserManagement />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
