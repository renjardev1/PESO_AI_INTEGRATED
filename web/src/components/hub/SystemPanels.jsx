// components/hub/SystemPanels.jsx — PESO AI
// Panels: LogsPanel, AuditPanel, AdminMgmtPanel
// REFACTOR: Replaced all window.confirm() with custom in-app ConfirmModal
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RefreshCw, Trash2, Printer, FileSpreadsheet,
  UserMinus, ShieldCheck, Eye, EyeOff,
  LogIn, LogOut, Edit3, PlusCircle, Trash,
  Image, Key, User, Shield, AlertTriangle, X,
} from 'lucide-react';
import { Badge } from '../UIAtoms';
import { generateAuditPDF }  from '../../pdf/auditPDF';
import { generateAuditXLSX } from '../../pdf/auditExport';
import logo from '../../assets/logo.png';
import { apiFetch } from '../../utils/authClient';
import { getCurrentUser } from '../../utils/clientSession';

const BASE = '';

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════════ */
const C = {
  primary:        '#0F172A',
  primaryHover:   '#1E293B',
  primaryMid:     '#334155',
  primaryLight:   '#EEF2FF',
  primaryBorder:  '#C7D2FE',
  primaryText:    '#4338CA',

  successBg:      '#F0FDF4',
  successBorder:  '#BBF7D0',
  successText:    '#15803D',
  successDot:     '#22C55E',

  neutralBg:      '#F8FAFC',
  neutralBorder:  '#E2E8F0',
  neutralText:    '#475569',
  neutralDot:     '#94A3B8',
  neutralSubtext: '#94A3B8',
  neutralLine:    '#F1F5F9',

  warningBg:      '#FFFBEB',
  warningBorder:  '#FDE68A',
  warningText:    '#B45309',
  warningDot:     '#F59E0B',

  dangerBg:       '#FFF5F5',
  dangerBorder:   '#FECACA',
  dangerText:     '#B91C1C',
  dangerDot:      '#EF4444',

  infoBg:         '#EFF6FF',
  infoBorder:     '#BFDBFE',
  infoText:       '#1D4ED8',
  infoDot:        '#3B82F6',

  surface:        '#FFFFFF',
  surfaceAlt:     '#F8FAFC',
  rowHover:       '#F1F5F9',

  textBase:       '#0F172A',
  textMid:        '#1E293B',
  textSub:        '#475569',
  textMuted:      '#94A3B8',
};

/* ═══════════════════════════════════════════════════════════════
   CONFIRM MODAL — replaces window.confirm() everywhere
   ═══════════════════════════════════════════════════════════════ */
const ConfirmModal = ({ open, title, message, confirmLabel = 'Confirm', danger = true, onConfirm, onCancel }) => {
  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes cmFadeIn  { from { opacity: 0; }                              to { opacity: 1; } }
        @keyframes cmSlideIn { from { opacity: 0; transform: scale(0.93) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>

      {/* Overlay — sits above HubModal (z 9998) but below GlobalNotificationModal (z 9999) */}
      <div
        onClick={onCancel}
        style={{
          position:        'fixed',
          inset:           0,
          zIndex:          9998,
          background:      'rgba(10, 25, 47, 0.45)',
          backdropFilter:  'blur(6px)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          padding:         16,
          animation:       'cmFadeIn 0.18s ease',
        }}
      >
        {/* Panel */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width:        '100%',
            maxWidth:     380,
            background:   C.surface,
            borderRadius: 20,
            boxShadow:    '0 24px 60px rgba(10,25,47,0.18), 0 4px 16px rgba(10,25,47,0.08)',
            border:       `1px solid ${danger ? C.dangerBorder : C.neutralBorder}`,
            overflow:     'hidden',
            animation:    'cmSlideIn 0.24s cubic-bezier(0.34,1.4,0.64,1)',
          }}
        >
          {/* Header stripe */}
          <div style={{
            background:    danger
              ? 'linear-gradient(135deg, #FFF5F5 0%, #FFF1F2 100%)'
              : 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
            borderBottom:  `1px solid ${danger ? C.dangerBorder : C.neutralBorder}`,
            padding:       '18px 20px 16px',
            display:       'flex',
            alignItems:    'flex-start',
            justifyContent:'space-between',
            gap:           12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Icon bubble */}
              <div style={{
                width:          40,
                height:         40,
                borderRadius:   12,
                background:     danger ? C.dangerBg : C.infoBg,
                border:         `1.5px solid ${danger ? C.dangerBorder : C.infoBorder}`,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                flexShrink:     0,
              }}>
                <AlertTriangle size={18} color={danger ? C.dangerDot : C.infoDot} />
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: danger ? '#FDA4AF' : C.neutralSubtext, marginBottom: 3 }}>
                  Confirmation Required
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: danger ? C.dangerText : C.textBase, letterSpacing: '-0.02em' }}>
                  {title}
                </div>
              </div>
            </div>

            {/* Close X */}
            <button
              onClick={onCancel}
              style={{
                width:          28,
                height:         28,
                borderRadius:   8,
                border:         `1px solid ${danger ? C.dangerBorder : C.neutralBorder}`,
                background:     'rgba(255,255,255,0.8)',
                color:          C.textMuted,
                cursor:         'pointer',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                flexShrink:     0,
                transition:     'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = danger ? C.dangerBg : C.infoBg; e.currentTarget.style.color = danger ? C.dangerDot : C.infoDot; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.8)'; e.currentTarget.style.color = C.textMuted; }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '16px 20px 20px' }}>
            <p style={{
              fontSize:   13,
              fontWeight: 500,
              color:      C.textSub,
              lineHeight: 1.6,
              margin:     '0 0 18px',
            }}>
              {message}
            </p>

            {/* Warning note */}
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          8,
              padding:      '9px 12px',
              background:   danger ? '#FFF8F8' : C.infoBg,
              border:       `1px solid ${danger ? '#FECACA' : C.infoBorder}`,
              borderRadius: 10,
              marginBottom: 18,
            }}>
              <AlertTriangle size={11} color={danger ? C.dangerDot : C.infoDot} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: danger ? C.dangerText : C.infoText }}>
                {danger ? 'This action cannot be undone.' : 'Please confirm before proceeding.'}
              </span>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              {/* Cancel */}
              <button
                onClick={onCancel}
                style={{
                  flex:         1,
                  padding:      '10px 0',
                  borderRadius: 11,
                  border:       `1.5px solid ${C.neutralBorder}`,
                  background:   C.surface,
                  fontSize:     13,
                  fontWeight:   700,
                  color:        C.textSub,
                  cursor:       'pointer',
                  fontFamily:   'inherit',
                  transition:   'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.surfaceAlt; e.currentTarget.style.borderColor = C.neutralText; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.surface;    e.currentTarget.style.borderColor = C.neutralBorder; }}
              >
                Cancel
              </button>

              {/* Confirm */}
              <button
                onClick={onConfirm}
                style={{
                  flex:         1,
                  padding:      '10px 0',
                  borderRadius: 11,
                  border:       'none',
                  background:   danger
                    ? 'linear-gradient(135deg, #EF4444, #F87171)'
                    : `linear-gradient(135deg, ${C.infoText}, ${C.infoDot})`,
                  fontSize:     13,
                  fontWeight:   800,
                  color:        '#fff',
                  cursor:       'pointer',
                  fontFamily:   'inherit',
                  boxShadow:    danger
                    ? '0 4px 14px rgba(239,68,68,0.35)'
                    : `0 4px 14px rgba(59,130,246,0.35)`,
                  transition:   'opacity 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════
   SHARED BUTTON STYLES
   ═══════════════════════════════════════════════════════════════ */
const btnBase = {
  display:    'flex',
  alignItems: 'center',
  gap:        5,
  padding:    '6px 12px',
  fontSize:   10,
  fontWeight: 700,
  background: 'none',
  border:     'none',
  cursor:     'pointer',
  fontFamily: 'inherit',
  transition: 'color 0.15s',
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
const gf = (log, ...keys) => {
  for (const k of keys) if (log[k] != null && log[k] !== '') return String(log[k]);
  return '—';
};

const actionCfg = (action = '') => {
  const a = action.toLowerCase();
  if (/^login/.test(a))                    return { bg: C.successBg,  text: C.successText,  border: C.successBorder,  icon: <LogIn      size={9} /> };
  if (/^logout/.test(a))                   return { bg: C.neutralBg,  text: C.neutralText,  border: C.neutralBorder,  icon: <LogOut     size={9} /> };
  if (/(creat|add)/.test(a))              return { bg: C.infoBg,     text: C.infoText,     border: C.infoBorder,     icon: <PlusCircle size={9} /> };
  if (/(delet|remov|clear)/.test(a))      return { bg: C.dangerBg,   text: C.dangerText,   border: C.dangerBorder,   icon: <Trash      size={9} /> };
  if (/(edit|updat|chang)/.test(a))       return { bg: C.warningBg,  text: C.warningText,  border: C.warningBorder,  icon: <Edit3      size={9} /> };
  if (/(password|pw)/.test(a))            return { bg: C.warningBg,  text: C.warningText,  border: C.warningBorder,  icon: <Key        size={9} /> };
  if (/(avatar|picture|photo|image)/.test(a)) return { bg: C.warningBg, text: C.warningText, border: C.warningBorder, icon: <Image     size={9} /> };
  if (/(display.?name|name|profile)/.test(a)) return { bg: C.warningBg, text: C.warningText, border: C.warningBorder, icon: <User      size={9} /> };
  return { bg: C.neutralBg, text: C.neutralText, border: C.neutralBorder, icon: <Shield size={9} /> };
};

const ActionBadge = ({ action }) => {
  const { bg, text, border, icon } = actionCfg(action);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 99,
      fontSize: 9, fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase',
      background: bg, color: text, border: `1px solid ${border}`,
      lineHeight: 1.4, maxWidth: '100%', overflow: 'visible', flexWrap: 'wrap',
    }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{ overflow: 'visible', textOverflow: 'clip', whiteSpace: 'normal', wordBreak: 'break-word' }}>{action}</span>
    </span>
  );
};

const RoleChip = ({ role }) => {
  const isMain = /main/i.test(role || '');
  return (
    <span style={{
      display: 'inline-block', fontSize: 8, fontWeight: 800,
      padding: '2px 6px', borderRadius: 99,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      background: isMain ? C.primaryLight : C.neutralBg,
      color:      isMain ? C.primaryText  : C.neutralText,
      border:     `1px solid ${isMain ? C.primaryBorder : C.neutralBorder}`,
      whiteSpace: 'nowrap', marginTop: 3,
    }}>
      {isMain ? 'Main' : 'Staff'}
    </span>
  );
};

const FILTER_DEFS = [
  { key: 'all',     label: 'All'     },
  { key: 'today',   label: 'Today'   },
  { key: 'Login',   label: 'Login'   },
  { key: 'Logout',  label: 'Logout'  },
  { key: 'Created', label: 'Created' },
  { key: 'Deleted', label: 'Deleted' },
  { key: 'Updated', label: 'Updated' },
];

const filterMatch = (log, filter) => {
  if (filter === 'all')   return true;
  if (filter === 'today') return String(gf(log, 'created_at', 'time', 'timestamp')).startsWith(new Date().toISOString().slice(0, 10));
  return gf(log, 'action').toLowerCase().includes(filter.toLowerCase());
};

const filterAccent = (key) => {
  if (key === 'today')   return { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' };
  if (key === 'Login')   return { bg: C.successBg,  text: C.successText,  border: C.successBorder  };
  if (key === 'Logout')  return { bg: C.neutralBg,  text: C.neutralText,  border: C.neutralBorder  };
  if (key === 'Created') return { bg: C.infoBg,     text: C.infoText,     border: C.infoBorder     };
  if (key === 'Deleted') return { bg: C.dangerBg,   text: C.dangerText,   border: C.dangerBorder   };
  if (key === 'Updated') return { bg: C.warningBg,  text: C.warningText,  border: C.warningBorder  };
  return { bg: C.neutralBg, text: C.neutralText, border: C.neutralBorder };
};

/* ══════════════════════════════════════════════════════════════
   ACTIVITY LOGS PANEL
══════════════════════════════════════════════════════════════ */
export const LogsPanel = ({ showToast }) => {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Confirm modal state ───────────────────────────────────
  const [confirm, setConfirm] = useState({ open: false });

  const currentUser = getCurrentUser() || {};
  const isMain      = currentUser.role === 'Main Admin';

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`${BASE}/api/logs`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setLogs(Array.isArray(d) ? d.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) : []);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, []);

  // Opens the styled confirm instead of window.confirm
  const handleClear = () => {
    if (!isMain) { showToast('Only Main Admin can clear logs.', 'error'); return; }
    setConfirm({
      open:         true,
      title:        'Clear All Logs',
      message:      'You are about to permanently delete all activity logs from the system.',
      confirmLabel: 'Yes, Clear All',
      onConfirm:    async () => {
        setConfirm({ open: false });
        await apiFetch(`${BASE}/api/logs`, { method: 'DELETE' });
        setLogs([]);
        showToast('All logs cleared.', 'warning');
      },
    });
  };

  const typeStyle = {
    FAILED:  { bg: C.dangerBg,  text: C.dangerText,  dot: C.dangerDot  },
    SYSTEM:  { bg: C.infoBg,    text: C.infoText,     dot: C.infoDot    },
    SUCCESS: { bg: C.successBg, text: C.successText,  dot: C.successDot },
  };

  return (
    <>
      {/* ── Confirm modal ────────────────────────────────── */}
      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel}
        danger
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm({ open: false })}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '65vh', overflowY: 'auto', paddingRight: 4, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted }}>{logs.length} records</span>
            <button onClick={fetchLogs} disabled={loading} style={{ ...btnBase, color: C.infoDot, padding: 0 }}>
              <RefreshCw size={9} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
          {isMain && (
            <button onClick={handleClear} style={{ ...btnBase, color: C.dangerText, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', padding: 0 }}>
              <Trash2 size={10} />Clear All
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <RefreshCw size={20} style={{ color: C.neutralBorder, animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.textMuted, fontSize: 12, fontStyle: 'italic' }}>No logs yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {logs.map((log, i) => {
              const s = typeStyle[log.type] || typeStyle.SUCCESS;
              return (
                <div key={log.id ?? i} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12, background: s.bg, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', color: s.text }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
                      {log.type}
                    </span>
                    <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 500 }}>
                      {new Date(log.timestamp).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 800, color: C.textBase, margin: 0 }}>{log.user_name}</p>
                  <p style={{ fontSize: 10, color: C.textSub, margin: 0, lineHeight: 1.4, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{log.message}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

/* ══════════════════════════════════════════════════════════════
   AUDIT TRAIL PANEL
══════════════════════════════════════════════════════════════ */
export const AuditPanel = () => {
  const [logs,     setLogs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [pdfBusy,  setPdfBusy]  = useState(false);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const [filter,   setFilter]   = useState('all');

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const r     = await apiFetch(`${BASE}/api/auth/audit-logs`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setLogs(Array.isArray(d) ? d : []);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAudit(); }, []);

  const handleExportXLSX = async () => {
    setXlsxBusy(true);
    try { await generateAuditXLSX(logs, { filter }); }
    catch (e) { console.error('Audit Excel error:', e); }
    finally { setXlsxBusy(false); }
  };

  const handleExportPDF = async () => {
    setPdfBusy(true);
    try { await generateAuditPDF(logs, { filter }, logo); }
    catch (e) { console.error('Audit PDF error:', e); }
    finally { setPdfBusy(false); }
  };

  const visible  = logs.filter(l => filterMatch(l, filter));
  const countFor = (key) => key === 'all' ? logs.length : logs.filter(l => filterMatch(l, key)).length;
  const anyBusy  = pdfBusy || xlsxBusy;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '65vh', overflow: 'hidden' }}>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted }}>{logs.length} records</span>
          <button onClick={fetchAudit} disabled={loading} style={{ ...btnBase, color: C.infoDot, padding: 0 }}>
            <RefreshCw size={9} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.neutralBorder}`, borderRadius: 10, overflow: 'hidden', background: C.surface }}>
          <button onClick={handleExportXLSX} disabled={anyBusy || logs.length === 0}
            style={{ ...btnBase, color: xlsxBusy ? C.textMuted : C.successText, borderRight: `1px solid ${C.neutralBorder}`, opacity: anyBusy || logs.length === 0 ? 0.45 : 1, cursor: anyBusy || logs.length === 0 ? 'not-allowed' : 'pointer' }}>
            {xlsxBusy ? <><RefreshCw size={10} style={{ animation: 'spin 0.8s linear infinite' }} />Exporting…</> : <><FileSpreadsheet size={11} />Excel</>}
          </button>
          <button onClick={handleExportPDF} disabled={anyBusy || logs.length === 0}
            style={{ ...btnBase, color: pdfBusy ? C.textMuted : C.infoText, opacity: anyBusy || logs.length === 0 ? 0.45 : 1, cursor: anyBusy || logs.length === 0 ? 'not-allowed' : 'pointer' }}>
            {pdfBusy ? <><RefreshCw size={10} style={{ animation: 'spin 0.8s linear infinite' }} />Generating…</> : <><Printer size={10} />PDF</>}
          </button>
        </div>
      </div>

      {/* ── Filter pills ────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0 }}>
        {FILTER_DEFS.map(({ key, label }) => {
          const cnt    = countFor(key);
          const active = filter === key;
          const accent = filterAccent(key);
          return (
            <button key={key} onClick={() => setFilter(key)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 99,
              fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
              background: active ? C.primary     : accent.bg,
              color:      active ? '#FFFFFF'     : accent.text,
              border:     `1.5px solid ${active ? C.primary : accent.border}`,
            }}>
              {label}
              <span style={{ background: active ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.07)', color: active ? '#fff' : 'inherit', borderRadius: 99, padding: '1px 5px', fontSize: 8, fontWeight: 900 }}>
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', borderRadius: 12, border: `1px solid ${C.neutralBorder}`, background: C.surface, width: '100%' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <RefreshCw size={22} style={{ color: C.neutralBorder, animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : visible.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: C.textMuted, fontSize: 12, fontStyle: 'italic' }}>
            No entries match this filter.
          </div>
        ) : (
          <table style={{ width: '100%', minWidth: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '50%', minWidth: 120 }} />
              <col style={{ width: '25%', minWidth: 120 }} />
              <col style={{ width: '25%', minWidth: 120 }} />
            </colgroup>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr style={{ background: C.primary }}>
                {[{ label: 'Action', align: 'left' }, { label: 'Admin', align: 'left' }, { label: 'Timestamp', align: 'right' }].map(({ label, align }) => (
                  <th key={label} style={{ padding: '14px 20px', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#FFFFFF', textAlign: align, borderBottom: `2px solid ${C.primaryHover}` }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((entry, i) => {
                const action = gf(entry, 'action');
                const admin  = gf(entry, 'admin_name', 'admin', 'user');
                const role   = gf(entry, 'admin_role', 'role');
                const ts     = gf(entry, 'created_at', 'time', 'timestamp');
                const rowBg  = i % 2 === 0 ? C.surface : C.surfaceAlt;
                let tsDate = '—', tsTime = '';
                try {
                  const d = new Date(ts);
                  if (!isNaN(d)) {
                    tsDate = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
                    tsTime = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
                  }
                } catch {}
                return (
                  <tr key={entry.id ?? i} style={{ background: rowBg, transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.rowHover}
                    onMouseLeave={e => e.currentTarget.style.background = rowBg}>
                    <td style={{ padding: '14px 20px', borderBottom: `1px solid ${C.neutralLine}`, overflow: 'visible', minWidth: 120, verticalAlign: 'top' }}><ActionBadge action={action} /></td>
                    <td style={{ padding: '14px 20px', borderBottom: `1px solid ${C.neutralLine}`, overflow: 'visible', minWidth: 120, verticalAlign: 'top' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, overflow: 'visible', textOverflow: 'clip', whiteSpace: 'normal', wordBreak: 'break-word' }}>{admin}</div>
                      <RoleChip role={role} />
                    </td>
                    <td style={{ padding: '14px 20px', borderBottom: `1px solid ${C.neutralLine}`, textAlign: 'right', minWidth: 120, verticalAlign: 'top' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: C.textMid,   whiteSpace: 'nowrap' }}>{tsDate}</div>
                      <div style={{ fontSize:  9, fontWeight: 500, color: C.textMuted, whiteSpace: 'nowrap' }}>{tsTime}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 600 }}>Showing {visible.length} of {logs.length} records</span>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   PASSWORD REQUIREMENTS
══════════════════════════════════════════════════════════════ */
const pwChecks = [
  { key: 'length',  label: '8+ characters',   test: p => p.length >= 8 },
  { key: 'upper',   label: 'Uppercase letter', test: p => /[A-Z]/.test(p) },
  { key: 'number',  label: 'Number',           test: p => /[0-9]/.test(p) },
  { key: 'special', label: 'Special char',     test: p => /[^A-Za-z0-9]/.test(p) },
];

const PasswordRequirements = ({ password }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', padding: '10px 12px', background: C.surfaceAlt, borderRadius: 12, border: `1px solid ${C.neutralLine}` }}>
    {pwChecks.map(({ key, label, test }) => {
      const passed = test(password);
      return (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: passed ? C.successDot : C.neutralBorder, transition: 'background 0.2s' }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: passed ? C.successText : C.textMuted, transition: 'color 0.2s' }}>{label}</span>
        </div>
      );
    })}
  </div>
);

/* ══════════════════════════════════════════════════════════════
   ADMIN MANAGEMENT PANEL
══════════════════════════════════════════════════════════════ */
export const AdminMgmtPanel = ({ currentUser, showToast }) => {
  const [view,     setView]     = useState('list');
  const [admins,   setAdmins]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [form,     setForm]     = useState({ username: '', password: '' });
  const [busy,     setBusy]     = useState(false);
  const [msg,      setMsg]      = useState({ text: '', type: '' });
  const [showPass, setShowPass] = useState(false);

  // ── Confirm modal state ───────────────────────────────────
  const [confirm, setConfirm] = useState({ open: false });

  const pollRef   = useRef(null);
  const allPassed = pwChecks.every(({ test }) => test(form.password));

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const r     = await apiFetch(`${BASE}/api/auth/admins`);
      if (!r.ok) throw new Error();
      setAdmins(await r.json());
    } catch { setAdmins([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchAdmins();
    pollRef.current = setInterval(fetchAdmins, 30_000);
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (view !== 'add') pollRef.current = setInterval(fetchAdmins, 30_000);
    return () => clearInterval(pollRef.current);
  }, [view]);

  // Opens the styled confirm instead of window.confirm
  const handleDelete = (admin) => {
    const name = admin.username || admin.name;
    if (name === currentUser.name) { showToast('Cannot remove your own account.', 'error'); return; }
    setConfirm({
      open:         true,
      title:        'Remove Admin',
      message:      `You are about to remove "${name}" from the admin list. They will lose all access immediately.`,
      confirmLabel: 'Yes, Remove',
      onConfirm:    async () => {
        setConfirm({ open: false });
        try {
          const res = await apiFetch(`${BASE}/api/auth/admins/${admin.admin_id}`, { method: 'DELETE' });
          const data  = await res.json();
          if (!res.ok) throw new Error(data.message);
          showToast(`Removed: ${name}`, 'warning');
          fetchAdmins();
        } catch (err) { showToast(`❌ ${err.message}`, 'error'); }
      },
    });
  };

  const handleCreate = async e => {
    e.preventDefault();
    setMsg({ text: '', type: '' });
    if (!allPassed) { setMsg({ text: '❌ Password does not meet all requirements.', type: 'error' }); return; }
    setBusy(true);
    try {
      const res   = await apiFetch(`${BASE}/api/auth/admins`, {
        method:  'POST',
        body:    JSON.stringify({ username: form.username, password: form.password, role: 'Staff Admin' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMsg({ text: `✅ "${form.username}" created!`, type: 'success' });
      setForm({ username: '', password: '' });
      fetchAdmins();
    } catch (err) { setMsg({ text: `❌ ${err.message}`, type: 'error' }); }
    finally { setBusy(false); }
  };

  return (
    <>
      {/* ── Confirm modal ────────────────────────────────── */}
      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel}
        danger
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm({ open: false })}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 }}>

        {/* ── Tab switcher ────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {[{ k: 'list', label: `Admins (${admins.length})` }, { k: 'add', label: '+ Add New' }].map(({ k, label }) => (
            <button key={k}
              onClick={() => { setView(k); setMsg({ text: '', type: '' }); setForm({ username: '', password: '' }); setShowPass(false); }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 12, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                background: k === view ? C.primary   : C.surfaceAlt,
                color:      k === view ? '#FFFFFF'   : C.textSub,
                border:     `1.5px solid ${k === view ? C.primary : C.neutralBorder}`,
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Admin list ──────────────────────────────────── */}
        {view === 'list' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted }}>{admins.length} accounts</span>
              <button onClick={fetchAdmins} disabled={loading} style={{ ...btnBase, color: C.infoDot, padding: 0 }}>
                <RefreshCw size={9} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
                Refresh
              </button>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                <RefreshCw size={18} style={{ color: C.neutralBorder, animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : admins.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: C.textMuted, fontSize: 12 }}>No admins found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {admins.map((a, i) => {
                  const username  = a.username || a.name || '?';
                  const label     = a.display_name || username;
                  const role      = a.role || 'Staff Admin';
                  const isSelf    = username === currentUser.name;
                  const isMainAcc = role === 'Main Admin';
                  return (
                    <div key={a.admin_id ?? i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, border: `1px solid ${C.neutralLine}`, background: C.surfaceAlt, gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {a.avatar
                            ? <img src={a.avatar} alt={username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <ShieldCheck size={14} color="#fff" />}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.textMid }}>{label}</span>
                            {isSelf && <Badge color="green">You</Badge>}
                          </div>
                          {a.display_name && a.display_name !== username && (
                            <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 500, display: 'block' }}>@{username}</span>
                          )}
                          <div style={{ marginTop: 3 }}>
                            <Badge color={isMainAcc ? 'blue' : 'slate'}>{role}</Badge>
                          </div>
                        </div>
                      </div>

                      {!isSelf && !isMainAcc
                        ? (
                          <button
                            onClick={() => handleDelete(a)}
                            style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: C.dangerDot, flexShrink: 0, transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = C.dangerBg}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            <UserMinus size={13} />
                          </button>
                        )
                        : <span style={{ fontSize: 9, color: C.neutralBorder, fontWeight: 700, flexShrink: 0 }}>Protected</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Add new admin form ───────────────────────────── */}
        {view === 'add' && (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 900, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>Username</label>
              <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${C.neutralBorder}`, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                placeholder="Enter username" required />
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 900, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: 12, border: `1.5px solid ${C.neutralBorder}`, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  placeholder="Enter password" required />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex', alignItems: 'center' }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {form.password.length > 0 && <PasswordRequirements password={form.password} />}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: C.surfaceAlt, borderRadius: 12, border: `1px solid ${C.neutralLine}` }}>
              <ShieldCheck size={14} color={C.infoDot} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.textSub }}>Role: <span style={{ color: C.infoText }}>Staff Admin</span></span>
              <span style={{ fontSize: 9, color: C.neutralBorder, marginLeft: 'auto' }}>(fixed)</span>
            </div>

            <button type="submit" disabled={busy || !allPassed || !form.username.trim()}
              style={{ padding: '12px 0', background: C.infoText, color: '#fff', borderRadius: 12, fontWeight: 700, fontSize: 13, border: 'none', fontFamily: 'inherit', cursor: busy || !allPassed || !form.username.trim() ? 'not-allowed' : 'pointer', opacity: busy || !allPassed || !form.username.trim() ? 0.5 : 1, transition: 'opacity 0.15s' }}>
              {busy ? 'Creating…' : 'Create Staff Admin'}
            </button>

            {msg.text && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                border: `1.5px solid ${msg.type === 'success' ? C.infoBorder : C.dangerBorder}`,
                background: msg.type === 'success' ? C.infoBg : C.dangerBg,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: msg.type === 'success' ? '#DBEAFE' : '#FEE2E2',
                  border: `1px solid ${msg.type === 'success' ? C.infoBorder : C.dangerBorder}`,
                  color: msg.type === 'success' ? C.infoText : C.dangerText,
                  flexShrink: 0,
                }}>
                  {msg.type === 'success' ? <ShieldCheck size={14} /> : <AlertTriangle size={14} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: msg.type === 'success' ? C.infoText : C.dangerText }}>
                    {msg.type === 'success' ? 'Staff Created' : 'Action Failed'}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginTop: 2 }}>{msg.text}</div>
                </div>
              </div>
            )}
          </form>
        )}

      </div>
    </>
  );
};
