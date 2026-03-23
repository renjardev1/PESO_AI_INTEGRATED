import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, BarChart2 } from 'lucide-react';

/* ── Hook: click outside ─────────────────────────────────────── */
export function useClickOutside(ref, cb) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, cb]);
}

/* ── Badge ───────────────────────────────────────────────────── */
// Supports named presets (green, blue, slate, amber, red)
// OR raw hex via color/bg/border props for backward compat
const BADGE_PRESETS = {
  green: { color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  blue:  { color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  slate: { color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
  amber: { color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  red:   { color: '#B91C1C', bg: '#FFF5F5', border: '#FECACA' },
};

export const Badge = ({ children, color = 'blue', bg, border }) => {
  const preset = BADGE_PRESETS[color]
    ?? { color, bg: bg ?? '#EEF2FF', border: border ?? 'transparent' };
  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      padding:      '2px 8px',
      borderRadius: 99,
      fontSize:     10,
      fontWeight:   700,
      background:   preset.bg,
      color:        preset.color,
      border:       `1px solid ${preset.border}`,
    }}>
      {children}
    </span>
  );
};

/* ── Divider ─────────────────────────────────────────────────── */
export const Divider = ({ style = {} }) => (
  <div style={{ height: 1, background: '#F1F5F9', margin: '6px 0', ...style }} />
);

/* ── SectionLabel ────────────────────────────────────────────── */
export const SectionLabel = ({ children }) => (
  <p style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 12px 4px' }}>
    {children}
  </p>
);

/* ── DropItem ────────────────────────────────────────────────── */
export const DropItem = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 12, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s' }}
    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
    onMouseLeave={e => e.currentTarget.style.background = 'none'}
  >
    <span style={{ color: '#94A3B8' }}>{icon}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{label}</span>
  </button>
);

/* ── ToggleSwitch ────────────────────────────────────────────── */
export const ToggleSwitch = ({ enabled, onChange, colorOn = 'bg-amber-500' }) => (
  <div
    onClick={e => { e.stopPropagation(); onChange(!enabled); }}
    style={{ width: 36, height: 20, borderRadius: 99, background: enabled ? '#F59E0B' : '#E2E8F0', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
  >
    <div style={{ position: 'absolute', top: 2, left: enabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', transition: 'left 0.2s' }} />
  </div>
);

/* ── EmptyState ──────────────────────────────────────────────── */
export const EmptyState = ({ msg = 'No data available.' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8 }}>
    <div style={{ width: 36, height: 36, borderRadius: 12, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <BarChart2 size={16} color="#CBD5E1" />
    </div>
    <span style={{ fontSize: 12, color: '#CBD5E1', fontWeight: 600 }}>{msg}</span>
  </div>
);

/* ── Card ────────────────────────────────────────────────────── */
export const Card = ({ children, style = {} }) => (
  <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #F1F5F9', boxShadow: '0 1px 4px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.03)', ...style }}>
    {children}
  </div>
);

/* ── Dropdown ────────────────────────────────────────────────── */
export const Dropdown = ({ options, value, onChange, dropRef }) => {
  const [open, setOpen] = useState(false);
  useClickOutside(dropRef, () => setOpen(false));
  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#F8FAFC', fontSize: 11, fontWeight: 700, color: '#475569', cursor: 'pointer', transition: 'all 0.15s' }}
      >
        {options.find(o => o.value === value)?.label}
        <ChevronDown size={10} style={{ transition: '0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, boxShadow: '0 8px 24px rgba(15,23,42,0.1)', zIndex: 30, overflow: 'hidden', minWidth: 130 }}>
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: value === o.value ? '#EFF6FF' : '#fff', color: value === o.value ? '#3B82F6' : '#475569', transition: 'background 0.12s' }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};