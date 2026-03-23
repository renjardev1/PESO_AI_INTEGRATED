// components/hub/ProfilePanels.jsx — PESO AI
// Panels: ProfilePanel, SecurityPanel
import React, { useState, useRef, useEffect } from 'react';
import {
  User, Mail, Shield, Clock, Camera,
  Edit3, Save, XCircle, Info, Lock,
  Eye, EyeOff, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '../UIAtoms';
import { ImageCropper } from './HubModal';
import { apiFetch } from '../../utils/authClient';
import { getCurrentUser, setCurrentUser } from '../../utils/clientSession';
import { useFormValidation } from '../../hooks/useFormValidation';

const BASE = '';

// ─── My Profile Panel ────────────────────────────────────────
export const ProfilePanel = ({ currentUser, showToast, onAvatarUpdate }) => {
  const username = currentUser.username || currentUser.name;
  // ── FIX: prefer DB display_name → then localStorage fallback → then username ──
  const storedDisplay =
    currentUser.display_name ||
    sessionStorage.getItem(`displayName_${username}`) ||
    username;

  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState({ name: storedDisplay });
  const [avatar,  setAvatar]  = useState(currentUser.avatar || null);
  const [cropSrc, setCropSrc] = useState(null);
  const [saving,  setSaving]  = useState(false);
  const fileRef = useRef();

  const saveAvatarToDB = async (base64) => {
    setSaving(true);
    try {
      const res   = await apiFetch(`${BASE}/api/auth/admins/avatar`, {
        method:  'PUT',
        body:    JSON.stringify({ avatar: base64 }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Failed to save avatar'); }
      const stored  = getCurrentUser() || {};
      const updated = { ...stored, avatar: base64 };
      setCurrentUser(updated);
      setAvatar(base64);
      onAvatarUpdate(base64);
      showToast('Profile picture saved!', 'success');
    } catch (err) { showToast(`❌ ${err.message}`, 'error'); }
    finally { setSaving(false); }
  };

  const save = async () => {
    // ── FIX: persist display name to DB so Main Admin sees updated names ──
    const newDisplayName = form.name.trim() || username;
    try {
      // 1. Save display name to DB
      const dnRes = await apiFetch(`${BASE}/api/auth/admins/display-name`, {
        method:  'PUT',
        body:    JSON.stringify({ displayName: newDisplayName }),
      });
      if (!dnRes.ok) {
        // Non-fatal: fall back to localStorage only
        console.warn('[DISPLAY NAME] DB save failed, using localStorage fallback');
      }

      // 2. Update localStorage (kept for backward compat + offline resilience)
      sessionStorage.setItem(`displayName_${username}`, newDisplayName);
      const stored  = getCurrentUser() || {};
      const updated = { ...stored, displayName: newDisplayName, display_name: newDisplayName, avatar };
      setCurrentUser(updated);

      // 3. Notify parent (AdminLayout) so the header updates immediately
      onAvatarUpdate(avatar, newDisplayName);

      // 4. Audit log — only if name actually changed
      const prevName = currentUser.display_name || currentUser.displayName || username;
      if (newDisplayName !== prevName) {
        await apiFetch(`${BASE}/api/auth/audit-logs`, {
          method: 'POST',
          body: JSON.stringify({ action: `Changed display name to "${newDisplayName}"`, target_type: 'admin' }),
        }).catch(() => {});
      }

      showToast('Profile updated!', 'success');
      setEditing(false);
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    }
  };

  const onFileChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCropSrc(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (cropSrc) return (
    <ImageCropper
      src={cropSrc}
      onDone={url => { setCropSrc(null); saveAvatarToDB(url); }}
      onCancel={() => setCropSrc(null)}
    />
  );

  return (
    <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
      <div className="flex flex-col items-center gap-3 pb-4 border-b border-slate-100">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-slate-900 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl">
            {saving
              ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : avatar
              ? <img src={avatar} alt="" className="w-full h-full object-cover" />
              : <ShieldCheck size={32} className="text-white" />}
          </div>
          <button
            onClick={() => fileRef.current?.click()} disabled={saving}
            className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Camera size={13} className="text-white" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        </div>
        <div className="text-center">
          {/* ── FIX: show display_name from DB first, then fallbacks ── */}
          <p className="font-black text-slate-900">
            {currentUser.display_name || currentUser.displayName || currentUser.name}
          </p>
          <Badge color="blue">{currentUser.role}</Badge>
          {saving && <p className="text-[10px] text-blue-500 font-semibold mt-1">Saving to database…</p>}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Display Name</label>
          <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 focus-within:border-blue-400 focus-within:bg-white transition-all">
            <span className="text-slate-400"><User size={14} /></span>
            {editing
              ? <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="flex-1 text-sm font-semibold text-slate-900 bg-transparent outline-none" />
              : <span className="flex-1 text-sm font-semibold text-slate-900">{form.name || '—'}</span>}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Username (Login)</label>
          <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50">
            <span className="text-slate-400"><Mail size={14} /></span>
            <span className="flex-1 text-sm font-semibold text-slate-900">{username}</span>
            <Badge color="slate">Read-only</Badge>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Role</label>
          <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50">
            <Shield size={14} className="text-blue-600" />
            <span className="flex-1 text-sm font-semibold text-slate-900">{currentUser.role}</span>
            <Badge color="slate">Read-only</Badge>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">Last Login</label>
          <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50">
            <Clock size={14} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-600">{localStorage.getItem('lastLogin') || 'No data'}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        {editing ? (
          <>
            <button onClick={save} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
              <Save size={14} />Save Changes
            </button>
            <button onClick={() => setEditing(false)} className="py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
              <XCircle size={14} />
            </button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all flex items-center justify-center gap-2">
            <Edit3 size={14} />Edit Profile
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Security Panel ───────────────────────────────────────────
export const SecurityPanel = ({ currentUser, showToast }) => {
  const {
    values: pw,
    errors,
    touched,
    handleChange,
    handleBlur,
    setValues: setPw,
    runValidation,
    isFormValid,
  } = useFormValidation(
    {
      current: { required: true },
      newPw: { required: true, passwordStrength: true },
      confirm: { required: true },
    },
    { current: '', newPw: '', confirm: '' }
  );
  const [show, setShow] = useState({ current: false, newPw: false, confirm: false });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(id);
  }, [saved]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!runValidation()) return;
    if (pw.newPw !== pw.confirm)  { showToast('Passwords do not match.', 'error');                return; }
    if (pw.current === pw.newPw)  { showToast('New password must differ from current.', 'error'); return; }
    setBusy(true);
    try {
      const res   = await apiFetch(`${BASE}/api/auth/admins/change-password`, {
        method:  'PUT',
        body:    JSON.stringify({ currentPassword: pw.current, newPassword: pw.newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Server error');
      showToast('Password changed successfully!', 'success');
      setSaved(true);
      setPw({ current: '', newPw: '', confirm: '' });
    } catch (err) { showToast(`❌ ${err.message}`, 'error'); }
    finally { setBusy(false); }
  };

  const checks = [
    { ok: pw.newPw.length >= 8,           label: '8+ characters'   },
    { ok: /[A-Z]/.test(pw.newPw),         label: 'Uppercase letter' },
    { ok: /[0-9]/.test(pw.newPw),         label: 'Number'           },
    { ok: /[^A-Za-z0-9]/.test(pw.newPw), label: 'Special char'     },
  ];

  return (
      <div className="max-h-[65vh] overflow-y-auto pr-1">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3">
            <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-600 font-medium leading-relaxed">
              Password change is saved directly to the database with bcrypt hashing. Use 8+ characters.
            </p>
          </div>
          {saved && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-3">
              <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-700">Password Updated</p>
                <p className="text-[11px] text-emerald-600 font-medium leading-relaxed">
                  Your new password is active now. You can continue using the dashboard.
                </p>
              </div>
            </div>
          )}

        {[{ key: 'current', label: 'Current Password' }, { key: 'newPw', label: 'New Password' }, { key: 'confirm', label: 'Confirm New Password' }].map(({ key, label }) => (
          <div key={key}>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-1">{label}</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 focus-within:border-blue-400 transition-all">
              <Lock size={14} className="text-slate-400" />
              <input
                type={show[key] ? 'text' : 'password'} value={pw[key]}
                name={key}
                onChange={handleChange}
                onBlur={handleBlur}
                className="flex-1 text-sm outline-none bg-transparent font-medium text-slate-800"
                placeholder="••••••••" required
              />
              <button type="button" onClick={() => setShow(s => ({ ...s, [key]: !s[key] }))} className="text-slate-300 hover:text-slate-500 transition-colors">
                {show[key] ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {touched[key] && errors[key] && (
              <p className="text-[10px] font-semibold text-red-500 ml-1 mt-1">{errors[key]}</p>
            )}
          </div>
        ))}

        {pw.newPw.length > 0 && (
          <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-2 gap-1">
            {checks.map(({ ok, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok ? 'bg-green-500' : 'bg-slate-300'}`} />
                <span className={`text-[10px] font-semibold ${ok ? 'text-green-600' : 'text-slate-400'}`}>{label}</span>
              </div>
            ))}
          </div>
        )}

        <button type="submit" disabled={busy || !isFormValid || pw.newPw !== pw.confirm}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
          {busy ? <><RefreshCw size={14} className="animate-spin" />Updating…</> : <><Save size={14} />Update Password</>}
        </button>
      </form>
    </div>
  );
};
