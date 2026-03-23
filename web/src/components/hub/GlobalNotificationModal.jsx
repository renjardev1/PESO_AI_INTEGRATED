// components/GlobalNotificationModal.jsx  –  PESO AI
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Bell, Megaphone, Clock, Sparkles, Lightbulb,
  Send, Calendar, CheckCircle2, AlertCircle,
  Loader2, Zap,
} from 'lucide-react';

const API = '/api/admin';
const MAX_CHARS = 200;

const NOTIF_TYPES = [
  {
    value: 'Announcement',
    label: 'Announcement',
    icon: Megaphone,
    accent: '#6366F1',
    light: '#EEF2FF',
    border: '#C7D2FE',
    placeholder: 'e.g. System maintenance scheduled this Friday from 12AM–2AM.',
  },
  {
    value: 'Reminder',
    label: 'Reminder',
    icon: Clock,
    accent: '#F59E0B',
    light: '#FFFBEB',
    border: '#FDE68A',
    placeholder: 'e.g. Reminder: Track your expenses weekly to improve savings.',
  },
  {
    value: 'New Feature',
    label: 'New Feature',
    icon: Sparkles,
    accent: '#10B981',
    light: '#ECFDF5',
    border: '#A7F3D0',
    placeholder: 'e.g. New Feature Alert: AI Advisor now suggests budget plans.',
  },
  {
    value: 'Tip & Advice',
    label: 'Tip & Advice',
    icon: Lightbulb,
    accent: '#0EA5E9',
    light: '#F0F9FF',
    border: '#BAE6FD',
    placeholder: 'e.g. Tip: Setting a weekly budget limit can help you save 20% more.',
  },
];

function useClickOutside(ref, cb) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, cb]);
}

const GlobalNotificationModal = ({ open, onClose, maintenance }) => {
  const [type,         setType]         = useState(NOTIF_TYPES[0]);
  const [message,      setMessage]      = useState('');
  const [sendMode,     setSendMode]     = useState('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [status,       setStatus]       = useState(null);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [history,      setHistory]      = useState([]);

  const panelRef = useRef(null);
  const maintenanceActive = !!maintenance?.active;
  const isSuperAdmin = maintenance?.role === 'Super Admin' || maintenance?.role === 'Main Admin';
  const isStaffAdmin = maintenance?.role === 'Staff Admin';
  const canOverride = isSuperAdmin && typeof maintenance?.onOverride === 'function';
  useClickOutside(panelRef, () => {
    if (maintenanceActive) return;
    if (status !== 'loading') onClose();
  });

  useEffect(() => {
    const lock = open || (maintenanceActive && !isSuperAdmin);
    document.body.style.overflow = lock ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open, maintenanceActive, isSuperAdmin]);

  useEffect(() => {
    if (open) {
      setType(NOTIF_TYPES[0]);
      setMessage('');
      setSendMode('now');
      setScheduleDate('');
      setScheduleTime('');
      setStatus(null);
      setErrorMsg('');
    }
  }, [open]);

  const charsLeft = MAX_CHARS - message.length;
  const pct       = (message.length / MAX_CHARS) * 100;
  const isValid   = message.trim().length > 0 && (sendMode === 'now' || (scheduleDate && scheduleTime));
  const todayISO  = new Date().toISOString().split('T')[0];

  const handleSend = useCallback(async () => {
    if (!isValid || status === 'loading') return;
    setStatus('loading');
    setErrorMsg('');
    const payload = {
      type:    type.value,
      message: message.trim(),
      send_at: sendMode === 'now' ? null : `${scheduleDate}T${scheduleTime}:00`,
    };
    try {
      const res = await fetch(`${API}/notifications/send`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Server error');
      setStatus('success');
      setHistory(prev => [{ ...payload, sent_at: new Date().toLocaleTimeString() }, ...prev.slice(0, 2)]);
      setTimeout(() => { setStatus(null); onClose(); }, 2200);
    } catch (e) {
      setStatus('error');
      setErrorMsg(e.message || 'Failed to send. Please try again.');
    }
  }, [isValid, status, type, message, sendMode, scheduleDate, scheduleTime, onClose]);

  if (!open && (!maintenanceActive || isSuperAdmin)) return null;

  if (maintenanceActive && !isSuperAdmin) {
    const remaining = Math.max(0, Number(maintenance?.secondsLeft || 0));
    const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
    const ss = String(remaining % 60).padStart(2, '0');
    const canLogout = typeof maintenance?.onForceLogout === 'function';
    return (
      <>
        <style>{`
          .mnt-overlay {
            position: fixed; inset: 0; z-index: 15;
            display: flex; align-items: center; justify-content: center; padding: 16px;
            background: rgba(14, 42, 71, 0.45);
            backdrop-filter: blur(10px);
          }
          .mnt-panel {
            width: 100%; max-width: 460px;
            background: #fff; border-radius: 24px; overflow: hidden;
            border: 1px solid #FECACA;
            box-shadow: 0 24px 60px rgba(14,42,71,0.18), 0 4px 16px rgba(14,42,71,0.06);
          }
        `}</style>
        <div className="mnt-overlay">
          <div className="mnt-panel">
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #FFF5F5 0%, #FFE4E6 100%)', borderBottom: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#FEE2E2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={18} color="#EF4444" />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F87171' }}>Maintenance Mode</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#7F1D1D' }}>System pause in progress</div>
              </div>
            </div>
            <div style={{ padding: '22px 24px', background: '#FFF7F7' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#7F1D1D', margin: 0 }}>
                The system will log out all active users for maintenance. Please save your work.
              </p>
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, border: '1px solid #FECACA', background: '#fff' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#991B1B', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Auto-Logout In</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: '#EF4444', letterSpacing: '0.08em' }}>{mm}:{ss}</span>
              </div>
            </div>
            <div style={{ padding: '14px 24px 18px', borderTop: '1px solid #FEE2E2', background: '#FFFDFD', textAlign: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#FCA5A5', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Please wait - logout is mandatory
              </span>
              {canLogout && (
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={maintenance.onForceLogout}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      border: '1px solid #FECACA',
                      background: '#FFF1F2',
                      color: '#B91C1C',
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      cursor: 'pointer',
                    }}
                  >
                    Logout Now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .pn-modal * { box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif; }

        .pn-overlay {
          position: fixed; inset: 0; z-index: 15;
          display: flex; align-items: center; justify-content: center; padding: 16px;
          background: rgba(14, 42, 71, 0.35);
          backdrop-filter: blur(10px);
          animation: pnFadeIn 0.2s ease;
        }
        @keyframes pnFadeIn { from { opacity: 0; } to { opacity: 1; } }

        .pn-panel {
          width: 100%; max-width: 460px;
          background: #FFFFFF;
          border-radius: 24px;
          border: 1px solid #E0EEFF;
          box-shadow: 0 24px 60px rgba(14,42,71,0.12), 0 4px 16px rgba(14,42,71,0.06);
          overflow: hidden; max-height: 92vh;
          display: flex; flex-direction: column;
          animation: pnSlideIn 0.28s cubic-bezier(0.34,1.4,0.64,1);
        }
        @keyframes pnSlideIn {
          from { opacity: 0; transform: scale(0.94) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }

        .pn-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px 18px;
          background: linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%);
          border-bottom: 1px solid #DBEAFE;
          position: relative; overflow: hidden;
        }
        .pn-header::before {
          content: ''; position: absolute; top: -30px; right: -30px;
          width: 120px; height: 120px; border-radius: 50%;
          background: radial-gradient(circle, rgba(96,165,250,0.2) 0%, transparent 70%);
        }

        .pn-header-icon {
          width: 40px; height: 40px; border-radius: 12px;
          background: linear-gradient(135deg, #3B82F6, #60A5FA);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(59,130,246,0.3); flex-shrink: 0;
        }
        .pn-header-left { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; }
        .pn-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #93C5FD; }
        .pn-title   { font-size: 15px; font-weight: 800; color: #1E3A5F; letter-spacing: -0.02em; }

        .pn-close {
          position: relative; z-index: 1;
          width: 30px; height: 30px; border-radius: 8px;
          border: 1px solid #BFDBFE; background: rgba(255,255,255,0.8);
          color: #93C5FD; cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: all 0.15s;
        }
        .pn-close:hover { background: #fff; color: #3B82F6; border-color: #93C5FD; }

        .pn-body {
          flex: 1; overflow-y: auto; padding: 22px 24px;
          display: flex; flex-direction: column; gap: 20px;
          background: #FAFCFF;
          scrollbar-width: thin; scrollbar-color: #BFDBFE transparent;
        }

        .pn-label { font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #94A3B8; margin-bottom: 10px; }

        .pn-type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .pn-type-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 13px; border-radius: 12px;
          border: 1.5px solid #E2E8F0; background: #fff;
          cursor: pointer; transition: all 0.15s; text-align: left;
        }
        .pn-type-btn:hover { border-color: #BAE6FD; background: #F0F9FF; }
        .pn-type-btn.active { border-color: var(--accent); background: var(--light); box-shadow: 0 0 0 3px var(--accent-soft); }
        .pn-type-icon {
          width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: #F1F5F9; transition: all 0.15s;
        }
        .pn-type-btn.active .pn-type-icon { background: var(--accent); }
        .pn-type-name { font-size: 12px; font-weight: 700; color: #94A3B8; transition: color 0.15s; }
        .pn-type-btn.active .pn-type-name { color: var(--accent); }

        .pn-msg-wrap {
          background: #fff; border: 1.5px solid #E2E8F0;
          border-radius: 14px; overflow: hidden; transition: all 0.15s;
        }
        .pn-msg-wrap:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
        .pn-textarea {
          width: 100%; padding: 13px 15px; min-height: 96px;
          background: transparent; border: none; outline: none; resize: none;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 13px; font-weight: 500; color: #1E3A5F; line-height: 1.6;
        }
        .pn-textarea::placeholder { color: #CBD5E1; }
        .pn-char-row {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 14px; border-top: 1px solid #F1F5F9; background: #FAFCFF;
        }
        .pn-char-bar  { flex: 1; height: 3px; border-radius: 99px; background: #E2E8F0; overflow: hidden; }
        .pn-char-fill { height: 100%; border-radius: 99px; transition: width 0.2s, background 0.2s; }
        .pn-char-num  { font-size: 10px; font-weight: 700; transition: color 0.2s; white-space: nowrap; }

        .pn-delivery-tabs { display: flex; gap: 6px; }
        .pn-dtab {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
          padding: 10px; border-radius: 11px; border: 1.5px solid #E2E8F0; background: #fff;
          font-size: 12px; font-weight: 700; color: #94A3B8; cursor: pointer; transition: all 0.15s;
        }
        .pn-dtab:hover { border-color: #BAE6FD; background: #F0F9FF; color: #60A5FA; }
        .pn-dtab.active {
          background: linear-gradient(135deg, #3B82F6, #60A5FA);
          border-color: #3B82F6; color: #fff;
          box-shadow: 0 4px 12px rgba(59,130,246,0.25);
        }

        .pn-info {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 14px; border-radius: 11px; margin-top: 10px;
          font-size: 11px; font-weight: 600;
        }
        .pn-info.green { background: #ECFDF5; border: 1px solid #A7F3D0; color: #059669; }
        .pn-info.blue  { background: #EFF6FF; border: 1px solid #BFDBFE; color: #2563EB; }

        .pn-sched-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
        .pn-sched-label { display: block; font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #94A3B8; margin-bottom: 6px; }
        .pn-sched-input {
          width: 100%; padding: 10px 12px; border-radius: 10px;
          border: 1.5px solid #E2E8F0; background: #fff;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 12px; font-weight: 600; color: #1E3A5F; outline: none; transition: all 0.15s;
        }
        .pn-sched-input:focus { border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(96,165,250,0.15); }

        .pn-status { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 11px; font-size: 11px; font-weight: 600; }
        .pn-status.error   { background: #FFF1F2; border: 1px solid #FECDD3; color: #E11D48; }
        .pn-status.success { background: #ECFDF5; border: 1px solid #A7F3D0; color: #059669; }

        .pn-history-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 11px; margin-top: 6px; background: #fff; border: 1px solid #E2E8F0; }

        .pn-footer { padding: 16px 24px 20px; border-top: 1px solid #E0EEFF; background: linear-gradient(to bottom, #fff, #F5F9FF); }
        .pn-btn-row { display: flex; gap: 10px; }
        .pn-cancel {
          padding: 11px 18px; border-radius: 11px; border: 1.5px solid #E2E8F0; background: #fff;
          font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 700; color: #64748B;
          cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .pn-cancel:hover { background: #F8FAFC; border-color: #CBD5E1; color: #334155; }
        .pn-send {
          flex: 1; padding: 11px; border-radius: 11px; border: none;
          font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 800; color: #fff;
          cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .pn-send:disabled { opacity: 0.4; cursor: not-allowed; }
        .pn-hint { text-align: center; margin-top: 12px; font-size: 10px; font-weight: 600; letter-spacing: 0.06em; color: #CBD5E1; text-transform: uppercase; }
      `}</style>

      <div className="pn-modal">
        <div className="pn-overlay">
          <div ref={panelRef} className="pn-panel">

            {/* HEADER */}
            <div className="pn-header">
              <div className="pn-header-left">
                <div className="pn-header-icon"><Bell size={18} color="#fff" /></div>
                <div>
                  <div className="pn-eyebrow">Admin · Broadcast</div>
                  <div className="pn-title">Send Notification</div>
                </div>
              </div>
              <button className="pn-close" onClick={onClose} disabled={status === 'loading'}><X size={14} /></button>
            </div>

            {/* BODY */}
            <div className="pn-body">

              {/* TYPE */}
              <div>
                <div className="pn-label">Notification Type</div>
                <div className="pn-type-grid">
                  {NOTIF_TYPES.map(t => {
                    const Icon = t.icon;
                    const active = type.value === t.value;
                    return (
                      <button key={t.value}
                        className={`pn-type-btn${active ? ' active' : ''}`}
                        style={{ '--accent': t.accent, '--light': t.light, '--accent-soft': `${t.accent}22` }}
                        onClick={() => { setType(t); setMessage(''); }}>
                        <div className="pn-type-icon"><Icon size={14} color={active ? '#fff' : '#94A3B8'} /></div>
                        <span className="pn-type-name">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MESSAGE */}
              <div>
                <div className="pn-label">Message</div>
                <MsgBox message={message} setMessage={setMessage} type={type} charsLeft={charsLeft} pct={pct} />
              </div>

              {/* DELIVERY */}
              <div>
                <div className="pn-label">Delivery</div>
                <div className="pn-delivery-tabs">
                  {[{ v: 'now', label: 'Send Now', Icon: Zap }, { v: 'schedule', label: 'Schedule', Icon: Calendar }].map(({ v, label, Icon }) => (
                    <button key={v} className={`pn-dtab${sendMode === v ? ' active' : ''}`} onClick={() => setSendMode(v)}>
                      <Icon size={12} />{label}
                    </button>
                  ))}
                </div>

                {sendMode === 'now' && (
                  <div className="pn-info green"><Send size={12} color="#059669" />Notification will be pushed to all users immediately.</div>
                )}

                {sendMode === 'schedule' && (
                  <>
                    <div className="pn-sched-grid">
                      <div>
                        <span className="pn-sched-label">Date</span>
                        <input type="date" min={todayISO} value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="pn-sched-input" />
                      </div>
                      <div>
                        <span className="pn-sched-label">Time</span>
                        <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="pn-sched-input" />
                      </div>
                    </div>
                    {scheduleDate && scheduleTime && (
                      <div className="pn-info blue" style={{ marginTop: 10 }}>
                        <Calendar size={12} color="#2563EB" />
                        Scheduled for <strong style={{ marginLeft: 4 }}>
                          {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </strong>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* STATUS */}
              {status === 'error'   && <div className="pn-status error">  <AlertCircle  size={13} />{errorMsg}</div>}
              {status === 'success' && <div className="pn-status success"><CheckCircle2 size={13} />Notification {sendMode === 'now' ? 'sent' : 'scheduled'} successfully!</div>}

              {/* HISTORY */}
              {history.length > 0 && (
                <div>
                  <div className="pn-label">Recently Sent</div>
                  {history.map((h, i) => {
                    const t = NOTIF_TYPES.find(x => x.value === h.type) ?? NOTIF_TYPES[0];
                    const Icon = t.icon;
                    return (
                      <div key={i} className="pn-history-item">
                        <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: t.light, border: `1.5px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={12} color={t.accent} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.label}</div>
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{h.message}</div>
                        </div>
                        <span style={{ fontSize: 10, color: '#CBD5E1', flexShrink: 0, fontWeight: 600 }}>{h.sent_at}</span>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* FOOTER */}
            <div className="pn-footer">
              <div className="pn-btn-row">
                <button className="pn-cancel" onClick={onClose} disabled={status === 'loading'}>Cancel</button>
                <button className="pn-send" onClick={handleSend}
                  disabled={!isValid || status === 'loading' || status === 'success'}
                  style={{
                    background: isValid ? `linear-gradient(135deg, ${type.accent}, #60A5FA)` : '#E2E8F0',
                    color:      isValid ? '#fff' : '#94A3B8',
                    boxShadow:  isValid ? `0 4px 16px ${type.accent}44` : 'none',
                  }}>
                  {status === 'loading' ? <><Loader2 size={13} className="animate-spin" />Sending…</>
                  : status === 'success' ? <><CheckCircle2 size={13} />Sent!</>
                  : <>{sendMode === 'now' ? <Send size={13} /> : <Calendar size={13} />}{sendMode === 'now' ? 'Send Notification' : 'Schedule Notification'}</>}
                </button>
              </div>
              <div className="pn-hint">Web · Pushes to all active Android users</div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

const MsgBox = ({ message, setMessage, type, charsLeft, pct }) => {
  const warnColor = charsLeft < 20 ? '#E11D48' : charsLeft < 50 ? '#F59E0B' : '#94A3B8';
  const barColor  = charsLeft < 20 ? '#E11D48' : charsLeft < 50 ? '#F59E0B' : type.accent;
  return (
    <div className="pn-msg-wrap" style={{ '--accent': type.accent, '--accent-soft': `${type.accent}22` }}>
      <textarea className="pn-textarea" rows={4} placeholder={type.placeholder}
        value={message} onChange={e => setMessage(e.target.value.slice(0, 200))} />
      <div className="pn-char-row">
        <div className="pn-char-bar"><div className="pn-char-fill" style={{ width: `${pct}%`, background: barColor }} /></div>
        <span className="pn-char-num" style={{ color: warnColor }}>{charsLeft} left</span>
      </div>
    </div>
  );
};

export default GlobalNotificationModal;
