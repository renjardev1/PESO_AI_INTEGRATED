// pesir/src/layouts/AdminLayout.jsx
// Admin shell layout for authenticated sessions, maintenance controls, and profile actions.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, ShieldCheck, ChevronDown, ActivitySquare, Wrench } from 'lucide-react';
import logo from '../assets/logo.png';

import { ConfirmModal, Toast, useConfirm } from "../components/GlobalConfirmModal";
import GlobalNotificationModal from '../components/GlobalNotificationModal';

import { ProfileDropdown } from '../components/hub/ProfileDropdown';
import { HubModal } from '../components/hub/HubModal';
import { ProfilePanel, SecurityPanel } from '../components/hub/ProfilePanels';
import { LogsPanel, AuditPanel, AdminMgmtPanel } from '../components/hub/SystemPanels';
import { MaintenanceModePanel } from '../components/hub/MaintenanceModeModal';
import { BackupRestorePanel } from '../components/hub/BackupRestorePanel';
import { apiFetch } from '../utils/authClient';
import { clearSensitiveSessionData } from '../utils/clientSession';

const HUB_TITLES = {
  profile: 'My Profile',
  security: 'Security Settings',
  logs: 'Activity Logs',
  audit: 'Audit Trail',
  maintenance: 'Maintenance Mode',
  backupRestore: 'Backup & Restore',
  adminMgmt: 'Admin Management',
};

const HUB_MODAL_SIZES = {
  profile: 'sm',
  security: 'sm',
  maintenance: 'sm',
  backupRestore: 'xl',
  adminMgmt: 'md',
  logs: 'lg',
  audit: 'xl',
};

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { modal, toasts, confirm, showToast, handleConfirm, handleCancel } = useConfirm();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [hubView, setHubView] = useState(null);
  const [showNotif, setShowNotif] = useState(false);
  const [maintenance, setMaintenance] = useState({ active: false, endsAt: null });
  const [maintRemaining, setMaintRemaining] = useState(null);
  const [maintKicks, setMaintKicks] = useState([]);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const forcedRef = useRef(false);
  const maintFetchRef = useRef(0);

  const [currentUser, setCurrentUser] = useState(null);

  const isMainAdmin = currentUser?.role === 'Main Admin';
  const isSuperAdmin = currentUser?.role === 'Super Admin' || currentUser?.role === 'Main Admin';
  const isStaffAdmin = currentUser?.role === 'Staff Admin';
  const lastLogin = localStorage.getItem('lastLogin') || 'No data';

  const fetchProfile = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/admins/me');
      if (!res.ok) return;
      const data = await res.json();
      setCurrentUser((prev) => {
        const fallback = prev || {};
        return {
          ...fallback,
          id: data.userId || fallback.id,
          name: data.username || fallback.name || 'Admin',
          username: data.username || fallback.username || fallback.name || 'Admin',
          role: data.role || fallback.role || 'System Access',
          avatar: data.avatar || fallback.avatar || null,
          display_name: data.displayName || null,
          displayName: data.displayName || fallback.displayName || data.username || fallback.name || 'Admin',
        };
      });
    } catch {
      // silently fail
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const syncMaintenance = useCallback(() => {
    const now = Date.now();
    if (now - maintFetchRef.current < 4000) return;
    maintFetchRef.current = now;

    apiFetch('/api/maintenance')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || typeof data.active !== 'boolean') return;
        const nextEndsAt = data.active && data.endsAt ? Number(data.endsAt) : null;
        setMaintenance({ active: data.active, endsAt: Number.isFinite(nextEndsAt) ? nextEndsAt : null });
        if (!data.active) {
          setMaintRemaining(null);
          forcedRef.current = false;
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    syncMaintenance();

    let bc;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('pesoai_maint');
        bc.onmessage = (evt) => {
          const msg = evt?.data || {};
          if (msg.type === 'kick' && msg.kick) {
            setMaintKicks((prev) => [msg.kick, ...prev].slice(0, 50));
            return;
          }
          if (typeof msg.active === 'boolean') {
            const nextEndsAt = msg.active && msg.endsAt ? Number(msg.endsAt) : null;
            setMaintenance({ active: msg.active, endsAt: Number.isFinite(nextEndsAt) ? nextEndsAt : null });
            if (!msg.active) {
              setMaintRemaining(null);
              forcedRef.current = false;
            }
          }
        };
      } catch {
        // ignore BroadcastChannel errors
      }
    }

    const poll = setInterval(syncMaintenance, 1500);
    return () => {
      if (bc) bc.close();
      clearInterval(poll);
    };
  }, [syncMaintenance]);

  const clearMaintenance = useCallback(() => {
    setMaintenance({ active: false, endsAt: null });
    setMaintRemaining(null);
    forcedRef.current = false;

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
  }, []);

  const applyMaintenanceState = useCallback((nextActive, nextEndsAt = null) => {
    if (!nextActive) {
      setMaintRemaining(null);
      forcedRef.current = false;
    }
    setMaintenance({ active: nextActive, endsAt: nextEndsAt || null });

    apiFetch('/api/maintenance', {
      method: 'POST',
      body: JSON.stringify({ active: nextActive, endsAt: nextActive ? nextEndsAt : null }),
    }).catch(() => {});

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('pesoai_maint');
        bc.postMessage({ active: nextActive, endsAt: nextActive ? nextEndsAt : null });
        bc.close();
      } catch {
        // ignore BroadcastChannel errors
      }
    }
  }, []);

  const confirmMaintenanceOn = useCallback(async () => {
    const ok = await confirm({
      variant: 'maintenance',
      title: 'Activate Maintenance Mode?',
      subtitle: 'This will pause access for all Staff Admins and users.',
      subject: currentUser?.display_name || currentUser?.displayName || currentUser?.name || 'Admin',
    });
    return ok;
  }, [confirm, currentUser]);

  const handleMaintenanceToggle = useCallback(async (nextActive) => {
    if (!isSuperAdmin) return;
    if (nextActive && !maintenance.active) {
      const ok = await confirmMaintenanceOn();
      if (!ok) return;
      applyMaintenanceState(true, maintenance.endsAt || null);
      showToast('Maintenance mode is now ON. Staff and users will be blocked.', 'warning');
      return;
    }
    if (!nextActive) {
      clearMaintenance();
      showToast('Maintenance mode is now OFF. System resumed.', 'success');
      return;
    }
    applyMaintenanceState(true, maintenance.endsAt || null);
  }, [isSuperAdmin, maintenance.active, maintenance.endsAt, confirmMaintenanceOn, applyMaintenanceState, clearMaintenance, showToast]);

  const handleSetMaintenanceTimer = useCallback((duration = 1, unit = 'minutes') => {
    if (!maintenance.active || !isSuperAdmin) return;
    const value = Math.max(1, Math.min(999, Number(duration) || 1));
    const secMultiplier = unit === 'hours' ? 3600 : 60;
    const endsAt = Date.now() + (value * secMultiplier * 1000);
    applyMaintenanceState(true, endsAt);
    showToast(`Maintenance timer set for ${value} ${unit}.`, 'info');
  }, [maintenance.active, isSuperAdmin, applyMaintenanceState, showToast]);

  const handleExtendMaintenanceTimer = useCallback((duration = 1, unit = 'minutes') => {
    if (!maintenance.active || !isSuperAdmin) return;
    const currentEndsAt = Number(maintenance.endsAt);
    if (!Number.isFinite(currentEndsAt)) return;
    const value = Math.max(1, Math.min(999, Number(duration) || 1));
    const secMultiplier = unit === 'hours' ? 3600 : 60;
    const base = Math.max(Date.now(), currentEndsAt);
    const endsAt = base + (value * secMultiplier * 1000);
    applyMaintenanceState(true, endsAt);
    showToast(`Maintenance timer extended by ${value} ${unit}.`, 'warning');
  }, [maintenance.active, maintenance.endsAt, isSuperAdmin, applyMaintenanceState, showToast]);

  const forceLogout = useCallback(async () => {
    if (!isStaffAdmin) return;
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore logout API failure
    }
    clearSensitiveSessionData();
    sessionStorage.clear();
    localStorage.setItem('lastLogout', new Date().toLocaleString());

    const kick = {
      name: currentUser?.display_name || currentUser?.displayName || currentUser?.name || 'Staff Admin',
      role: currentUser?.role || 'Staff Admin',
      time: new Date().toLocaleString(),
    };
    setMaintKicks((prev) => [kick, ...prev].slice(0, 50));
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('pesoai_maint');
        bc.postMessage({ type: 'kick', kick });
        bc.close();
      } catch {
        // ignore BroadcastChannel errors
      }
    }

    navigate('/login', { replace: true });
  }, [navigate, isStaffAdmin, currentUser]);

  useEffect(() => {
    if (!maintenance.active || !maintenance.endsAt) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((maintenance.endsAt - Date.now()) / 1000));
      setMaintRemaining(remaining);
      if (remaining <= 0 && !forcedRef.current) {
        forcedRef.current = true;
        clearMaintenance();
        if (!isSuperAdmin) forceLogout();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [maintenance.active, maintenance.endsAt, forceLogout, isSuperAdmin, clearMaintenance]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const onKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        clearMaintenance();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSuperAdmin, clearMaintenance]);

  const openHub = (view) => {
    setHubView(view);
    setIsProfileOpen(false);
    if (view === 'profile') fetchProfile();
  };

  const handleAvatarUpdate = (base64, displayName) => {
    const updated = {
      ...(currentUser || {}),
      avatar: base64,
      ...(displayName !== undefined && { displayName, display_name: displayName }),
    };
    setCurrentUser(updated);
  };

  if (isProfileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (location.pathname === '/admin/users' && !isMainAdmin && !isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const handleLogout = async () => {
    const ok = await confirm({
      variant: 'logout',
      title: 'Sign Out?',
      subtitle: 'Your session will end.',
      subject: currentUser?.name || 'Admin',
    });
    if (!ok) return;

    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore logout API failure
    }

    clearSensitiveSessionData();
    sessionStorage.clear();
    localStorage.setItem('lastLogout', new Date().toLocaleString());
    navigate('/login', { replace: true });
  };

  const handleSwitchAccount = async () => {
    const ok = await confirm({
      variant: 'switch',
      title: 'Switch Account?',
      subtitle: "You'll be logged out.",
      subject: currentUser?.name || 'Admin',
    });
    if (!ok) return;

    clearSensitiveSessionData();
    sessionStorage.clear();
    navigate('/login', { state: { fromSwitch: true }, replace: true });
  };

  const pageMenuItems = [
    { name: 'Analytics Dashboard', path: '/admin', icon: <LayoutDashboard size={18} />, adminOnly: false },
    { name: 'User Management', path: '/admin/users', icon: <Users size={18} />, adminOnly: true },
  ];

  const modalMenuItems = [
    { name: 'Activity Logs', key: 'logs', icon: <ActivitySquare size={18} /> },
    { name: 'Audit Trail', key: 'audit', icon: <ShieldCheck size={18} /> },
    { name: 'Maintenance Mode', key: 'maintenance', icon: <Wrench size={18} />, isMaintenance: true },
    { name: 'Admin Management', key: 'adminMgmt', icon: <Users size={18} /> },
  ];

  const getHeaderTitle = () => {
    if (location.pathname === '/admin') return 'Financial Overview';
    if (location.pathname === '/admin/users') return 'Client Database';
    return 'Admin Control Center';
  };

  const AdminAvatar = ({ avatar, size = 10, rounded = 'xl' }) => {
    const sizeMap = { 10: 'w-10 h-10', 8: 'w-8 h-8', 20: 'w-20 h-20' };
    const cls = `${sizeMap[size] || 'w-10 h-10'} rounded-${rounded} bg-slate-900 flex items-center justify-center text-white shadow-lg overflow-hidden flex-shrink-0`;
    return (
      <div className={cls}>
        {avatar
          ? <img src={avatar} alt="" className="w-full h-full object-cover" />
          : <ShieldCheck size={size === 20 ? 32 : size === 8 ? 14 : 20} />}
      </div>
    );
  };

  const renderHub = () => {
    const safeUser = currentUser || {};

    switch (hubView) {
      case 'profile':
        return <ProfilePanel currentUser={safeUser} showToast={showToast} onAvatarUpdate={handleAvatarUpdate} />;
      case 'security':
        return <SecurityPanel currentUser={safeUser} showToast={showToast} />;
      case 'logs':
        return <LogsPanel currentUser={safeUser} showToast={showToast} />;
      case 'audit':
        return <AuditPanel />;
      case 'maintenance':
        return (
          <MaintenanceModePanel
            maintenance={{ ...maintenance, remaining: maintRemaining }}
            isSuperAdmin={isSuperAdmin}
            onToggle={handleMaintenanceToggle}
            onSetTime={handleSetMaintenanceTimer}
            onExtendTime={handleExtendMaintenanceTimer}
          />
        );
      case 'backupRestore':
        return <BackupRestorePanel currentUser={safeUser} showToast={showToast} />;
      case 'adminMgmt':
        return <AdminMgmtPanel currentUser={safeUser} showToast={showToast} />;
      default:
        return null;
    }
  };

  const displayName = currentUser?.display_name || currentUser?.displayName || currentUser?.name || 'Admin';

  return (
    <div className="admin-shell flex min-h-screen bg-[#F8FAFC]">
      <Toast toasts={toasts} />
      <ConfirmModal modal={modal} onConfirm={handleConfirm} onCancel={handleCancel} />
      <GlobalNotificationModal
        open={showNotif}
        onClose={() => setShowNotif(false)}
        maintenance={{
          active: maintenance.active,
          secondsLeft: maintRemaining,
          role: currentUser?.role,
          onOverride: clearMaintenance,
          onForceLogout: forceLogout,
        }}
      />

      <aside className="w-72 border-r border-slate-200 fixed h-full bg-white flex flex-col z-20 shadow-sm">
        <div className="p-8 flex items-center gap-3">
          <img src={logo} alt="PESO AI" className="w-10 h-10 object-contain drop-shadow-md" />
          <div className="flex flex-col">
            <span className="font-black text-lg text-blue-600 leading-none">PESO AI</span>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Administrator</span>
          </div>
        </div>
        <nav className="p-4 flex-1 space-y-1.5 mt-4">
          <p className="px-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Main Menu</p>
          {pageMenuItems.map((item) => {
            if (item.adminOnly && !(isMainAdmin || isSuperAdmin)) return null;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 ${isActive
                  ? 'bg-[#1E3A5F] text-white shadow-xl shadow-blue-200/60 translate-x-1'
                  : 'text-slate-500 hover:bg-[#2B4E7E] hover:text-white'}`}
              >
                {item.icon}
                <span className="text-sm font-bold tracking-tight">{item.name}</span>
              </Link>
            );
          })}

          {(isMainAdmin || isSuperAdmin) && (
            <div className="pt-2 mt-2 border-t border-slate-100 space-y-1.5">
              {modalMenuItems.map((item) => {
                if (item.mainAdminOnly && !(isMainAdmin || isSuperAdmin)) return null;
                const isOpen = hubView === item.key;
                const maintPulse = item.isMaintenance && maintenance.active;
                return (
                  <button
                    key={item.key}
                    onClick={() => openHub(item.key)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 ${
                      isOpen
                        ? 'bg-[#1E3A5F] text-white shadow-lg shadow-blue-200/60'
                        : 'text-slate-500 hover:bg-[#2B4E7E] hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      {item.icon}
                      <span className="text-sm font-bold tracking-tight">{item.name}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {maintPulse ? (
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_0_3px_rgba(249,115,22,0.2)]" />
                      ) : (
                        <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-white/80' : 'bg-slate-300'}`} />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </nav>
      </aside>

      <div className="flex-1 ml-72">
        <header className="h-24 bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-10 px-10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter">{getHeaderTitle()}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              <p className="text-[10px] text-blue-600 font-black uppercase tracking-[0.15em]">Live Security Protocol Active</p>
            </div>
          </div>

          <div className="flex items-center gap-6 relative">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold text-slate-900">Welcome, {displayName}</p>
              <div className="flex items-center gap-1 justify-end">
                <span className="text-[10px] text-slate-500">Last Login: {lastLogin}</span>
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsProfileOpen((o) => !o)}
                className={`flex items-center gap-3 p-1.5 pr-4 rounded-2xl border transition-all ${
                  isProfileOpen
                    ? 'bg-blue-50 border-blue-200 shadow-inner'
                    : 'bg-white border-slate-100 shadow-sm hover:shadow-md'
                }`}
              >
                <AdminAvatar avatar={currentUser?.avatar} size={10} rounded="xl" />
                <div className="flex flex-col text-left">
                  <span className="text-[11px] font-black text-slate-900 leading-none">{displayName}</span>
                  <span className="text-[9px] font-bold text-blue-600 uppercase">{currentUser?.role}</span>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {maintenance.active && isSuperAdmin && (
                <span className="absolute -top-2 -right-2 text-[8px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded-full shadow-sm inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  SYSTEM PAUSED FOR STAFF
                </span>
              )}

              {isProfileOpen && (
                <ProfileDropdown
                  currentUser={{ ...(currentUser || {}), displayName }}
                  lastLogin={lastLogin}
                  onOpenHub={openHub}
                  onNotif={() => setShowNotif(true)}
                  onSwitchAccount={handleSwitchAccount}
                  onLogout={handleLogout}
                  onClose={() => setIsProfileOpen(false)}
                />
              )}
            </div>
          </div>
        </header>

        <main className="p-10"><Outlet context={{ maintKicks }} /></main>
      </div>

      {hubView && (
        <HubModal title={HUB_TITLES[hubView] || 'Settings'} size={HUB_MODAL_SIZES[hubView] || 'sm'} onClose={() => setHubView(null)}>
          {renderHub()}
        </HubModal>
      )}
    </div>
  );
};

export default AdminLayout;
