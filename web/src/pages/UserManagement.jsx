// pages/UserManagement.jsx — PESO AI
import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
import {
  Search, MapPin, Mail, Clock, Calendar,
  CheckCircle, XCircle, Keyboard, FileText, FileSpreadsheet,
} from 'lucide-react';
import { ConfirmModal, Toast, useConfirm } from '../components/GlobalConfirmModal';
import { StaffActivityMonitor } from '../components/hub/StaffActivityMonitor';
import { generateUsersPDF  } from '../pdf/usersPDF';
import { generateUsersXLSX } from '../pdf/usersExport';
import logo from '../assets/logo.png';
import { apiFetch } from '../utils/authClient';

const UserManagement = () => {
  const { maintKicks = [] } = useOutletContext() || {};
  const location = useLocation();

  const [users,        setUsers]        = useState([]);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [loading,      setLoading]      = useState(true);
  const [pdfBusy,      setPdfBusy]      = useState(false);
  const [xlsxBusy,     setXlsxBusy]    = useState(false);
  const [currentUser,  setCurrentUser]  = useState(null);
  const { modal, toasts, confirm, showToast, handleConfirm, handleCancel } = useConfirm();

  // FIX: Main Admin OR Staff Admin can manage users (removed incorrect 'Super Admin' alias)
  const canManageUsers = currentUser?.role === 'Main Admin' || currentUser?.role === 'Staff Admin';

  const searchInputRef = useRef(null);

  useEffect(() => {
    const inboundFilter = location.state?.filter;
    if (inboundFilter && ['All', 'Active', 'Inactive', 'Disabled'].includes(inboundFilter)) {
      setFilterStatus(inboundFilter);
    }
  }, [location.state]);

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
    searchInputRef.current?.focus();
    const handleKeyDown = e => {
      if (e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.altKey && e.key.toLowerCase() === 'a') { e.preventDefault(); setFilterStatus('Active'); }
      if (e.altKey && e.key.toLowerCase() === 'i') { e.preventDefault(); setFilterStatus('Inactive'); }
      if (e.key === 'Escape') { setSearchTerm(''); setFilterStatus('All'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await apiFetch('/api/auth/admins/me');
      if (!res.ok) return;
      const data = await res.json();
      setCurrentUser({
        id:          data.userId      || null,
        name:        data.displayName || 'Admin',
        displayName: data.displayName || 'Admin',
        role:        data.role        || null,
      });
    } catch { setCurrentUser(null); }
  };

  const fetchUsers = async () => {
    try {
      const res  = await apiFetch('/api/users');
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) { console.error('Error fetching users:', err); }
    finally { setLoading(false); }
  };

  const fullName      = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ') || '—';
  const avatarFallback = (name) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=E2E8F0&color=334155`;
  const userAvatarSrc = (u) => u.avatar_url || u.profile_picture || avatarFallback(fullName(u));

  // FIX: statusOf now checks is_disabled + 3-day inactivity
  const statusOf = (u) => {
    if (u.is_disabled) return 'Disabled';
    if (!u.onboarding_completed) return 'Inactive';
    const last         = u.last_active_at ? new Date(u.last_active_at) : null;
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    if (!last || last < threeDaysAgo) return 'Inactive';
    return 'Active';
  };

  const formatDate = d => {
    if (!d) return 'Never';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  // FIX: now calls the correct superadmin disable/enable endpoints
  const handleStatusChange = async (userId, isCurrentlyDisabled, userName) => {
    if (!canManageUsers) return;
    const isDisabling = !isCurrentlyDisabled;
    const ok = await confirm({
      variant:  isDisabling ? 'disable' : 'enable',
      title:    isDisabling ? 'Disable Account?' : 'Enable Account?',
      subtitle: isDisabling
        ? 'This user will immediately lose access to the system.'
        : 'This user will regain full system access.',
      subject: userName,
    });
    if (!ok) return;
    try {
      const endpoint = isDisabling
        ? `/api/superadmin/users/${userId}/disable`
        : `/api/superadmin/users/${userId}/enable`;
      const res = await apiFetch(endpoint, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(isDisabling ? { reason: 'Disabled by admin' } : {}),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, is_disabled: isDisabling } : u
        ));
        showToast(
          isDisabling
            ? `${userName}'s account has been disabled.`
            : `${userName}'s account has been re-enabled.`,
          isDisabling ? 'error' : 'success'
        );
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to update account status.', 'error');
      }
    } catch {
      showToast('Server unreachable. Please check your connection.', 'error');
    }
  };

  // FIX: filter now handles Disabled + Inactive correctly
  const filteredUsers = users.filter(user => {
    const name = fullName(user);
    const s    = statusOf(user);
    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === 'All'      ||
      (filterStatus === 'Active'   && s === 'Active')   ||
      (filterStatus === 'Inactive' && s === 'Inactive') ||
      (filterStatus === 'Disabled' && s === 'Disabled');
    return matchesSearch && matchesStatus;
  });

  // ── Export handlers ───────────────────────────────────────
  const handleExportPDF = async () => {
    setPdfBusy(true);
    try { await generateUsersPDF(filteredUsers, { search: searchTerm, status: filterStatus }, logo); }
    catch (e) { console.error('PDF error:', e); showToast('PDF export failed. Try again.', 'error'); }
    finally { setPdfBusy(false); }
  };

  const handleExportXLSX = async () => {
    setXlsxBusy(true);
    try {
      await generateUsersXLSX(filteredUsers, { search: searchTerm, status: filterStatus });
      showToast(`Excel exported — ${filteredUsers.length} users.`, 'success');
    } catch (e) { console.error('Excel error:', e); showToast('Excel export failed. Try again.', 'error'); }
    finally { setXlsxBusy(false); }
  };

  const anyBusy        = pdfBusy || xlsxBusy;
  const activeCount    = users.filter(u => statusOf(u) === 'Active').length;
  const inactiveCount  = users.filter(u => statusOf(u) === 'Inactive').length;
  const disabledCount  = users.filter(u => statusOf(u) === 'Disabled').length;

  const Avatar = ({ user, size = 10 }) => (
    <img
      src={userAvatarSrc(user)}
      alt={fullName(user)}
      className={`h-${size} w-${size} rounded-full object-cover border border-slate-200`}
      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = avatarFallback(fullName(user)); }}
    />
  );

  // Status badge config
  const statusBadge = (status) => {
    switch (status) {
      case 'Active':   return { bg: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-500 animate-pulse' };
      case 'Inactive': return { bg: 'bg-rose-50 text-rose-600 border-rose-100',         dot: 'bg-rose-500' };
      case 'Disabled': return { bg: 'bg-slate-100 text-slate-500 border-slate-200',     dot: 'bg-slate-400' };
      default:         return { bg: 'bg-slate-100 text-slate-400 border-slate-100',     dot: 'bg-slate-300' };
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      <p className="text-slate-500 font-medium">Fetching User Database...</p>
    </div>
  );

  return (
    <>
      <Toast toasts={toasts} />
      <ConfirmModal modal={modal} onConfirm={handleConfirm} onCancel={handleCancel} />

      <div className="p-8 bg-slate-50 min-h-screen font-sans">

        {/* ── HEADER ───────────────────────────────────────── */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">User Access Control</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold uppercase tracking-wider">
                <Keyboard size={12} /> Admin Mode
              </span>
              {!canManageUsers && (
                <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold uppercase tracking-wider">
                  View Only
                </span>
              )}
              {location.state?.filter && location.state.filter !== 'All' && (
                <span className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-md text-[10px] font-bold uppercase tracking-wider">
                  Filtered: {location.state.filter} users
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                ref={searchInputRef} type="text"
                placeholder="Search name, email, location..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden divide-x divide-slate-200">
              <button onClick={handleExportPDF} disabled={anyBusy} title="Export PDF"
                className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-50">
                <FileText size={16} className="text-red-500" />
                {pdfBusy ? 'Generating…' : 'Export PDF'}
              </button>
              <button onClick={handleExportXLSX} disabled={anyBusy} title="Export Excel (.xlsx)"
                className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-green-50 hover:text-green-700 transition-all disabled:opacity-50">
                <FileSpreadsheet size={16} className="text-green-600" />
                {xlsxBusy ? 'Exporting…' : 'Export Excel'}
              </button>
            </div>
          </div>
        </div>

        {/* ── STAFF ACTIVITY MONITOR ─────────────────────── */}
        {currentUser?.role === 'Main Admin' && (
          <StaffActivityMonitor kicks={maintKicks} />
        )}

        {/* ── FILTER PILLS ─────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5">
          {[
            { label: 'All',      count: users.length,  color: 'bg-slate-100 text-slate-600 border-slate-200'       },
            { label: 'Active',   count: activeCount,   color: 'bg-emerald-50 text-emerald-600 border-emerald-200'  },
            { label: 'Inactive', count: inactiveCount, color: 'bg-rose-50 text-rose-600 border-rose-200'           },
            { label: 'Disabled', count: disabledCount, color: 'bg-slate-100 text-slate-500 border-slate-300'       },
          ].map(({ label, count, color }) => (
            <button key={label} onClick={() => setFilterStatus(label)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                filterStatus === label ? 'ring-2 ring-offset-1 ring-blue-400 ' + color : color + ' opacity-60 hover:opacity-100'
              }`}>
              {label}
              <span className="bg-white/60 px-1.5 py-0.5 rounded-full text-[10px] font-black">{count}</span>
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400 font-medium">
            Showing <strong className="text-slate-600">{filteredUsers.length}</strong> of {users.length} users
          </span>
        </div>

        {/* ── TABLE ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  {['User Profile', 'Contact Info', 'Activity', 'Current Status', 'Actions'].map(h => (
                    <th key={h} className={`px-6 py-5 text-xs font-bold text-slate-400 uppercase tracking-wider ${['Current Status', 'Actions'].includes(h) ? 'text-center' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length > 0 ? filteredUsers.map(user => {
                  const name            = fullName(user);
                  const status          = statusOf(user);
                  const isDisabledUser  = !!user.is_disabled;
                  const badge           = statusBadge(status);
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">

                      {/* User Profile */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <Avatar user={user} size={10} />
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{name}</div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Calendar size={10} /> Joined: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="px-6 py-5">
                        <div className="flex flex-col space-y-1 text-xs text-slate-500">
                          <div className="flex items-center gap-2"><Mail size={12} className="text-slate-300" />{user.email}</div>
                          <div className="flex items-center gap-2"><MapPin size={12} className="text-slate-300" />{user.location || 'No Data'}</div>
                        </div>
                      </td>

                      {/* Activity */}
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Last Online</span>
                          <div className="flex items-center text-xs text-slate-600 font-medium gap-2">
                            <Clock size={14} className="text-blue-500" />{formatDate(user.last_active_at)}
                          </div>
                        </div>
                      </td>

                      {/* Status badge — now handles Active / Inactive / Disabled */}
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold uppercase border ${badge.bg}`}>
                          <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${badge.dot}`} />
                          {status}
                        </span>
                      </td>

                      {/* Actions — button flips between Disable and Enable based on is_disabled */}
                      <td className="px-6 py-5 text-center">
                        <button
                          onClick={() => handleStatusChange(user.id, isDisabledUser, name)}
                          disabled={!canManageUsers}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm border ${
                            !canManageUsers
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : isDisabledUser
                                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-md'
                                : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'
                          }`}
                        >
                          {!canManageUsers
                            ? 'Restricted'
                            : isDisabledUser
                              ? <><CheckCircle size={14} /> Enable</>
                              : <><XCircle size={14} /> Disable</>
                          }
                        </button>
                      </td>

                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-slate-400 text-sm italic">
                      No users found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
};

export default UserManagement;