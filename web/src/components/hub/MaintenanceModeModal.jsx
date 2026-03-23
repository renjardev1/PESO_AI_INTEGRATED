// pesir/src/components/hub/MaintenanceModeModal.jsx
// Maintenance mode control panel for AdminLayout HubModal.
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Clock3, TimerReset, Wrench } from 'lucide-react';

const toSeconds = (endsAt, fallback = 0) => {
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  const end = Number(endsAt);
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
};

const formatRemaining = (seconds) => {
  const total = Math.max(0, Number(seconds) || 0);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;

  if (hh > 0) {
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

export const MaintenanceModePanel = ({
  maintenance,
  isSuperAdmin,
  onToggle,
  onSetTime,
  onExtendTime,
}) => {
  const isActive = !!maintenance?.active;
  const [durationValue, setDurationValue] = useState(1);
  const [durationUnit, setDurationUnit] = useState('minutes');

  const remaining = useMemo(
    () => toSeconds(maintenance?.endsAt, Number(maintenance?.remaining)),
    [maintenance?.endsAt, maintenance?.remaining]
  );

  const hasActiveTimer = isActive && remaining > 0;
  const canSet = isSuperAdmin && isActive;
  const canExtend = isSuperAdmin && isActive && hasActiveTimer;

  const handleValueChange = (e) => {
    const raw = String(e.target.value || '').replace(/[^0-9]/g, '');
    if (!raw) {
      setDurationValue(1);
      return;
    }
    const next = Math.max(1, Math.min(999, Number(raw)));
    setDurationValue(next);
  };

  return (
    <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">System State</p>
            <h4 className="text-base font-black text-slate-900 mt-1">Maintenance Mode</h4>
          </div>
          <button
            type="button"
            disabled={!isSuperAdmin}
            onClick={() => onToggle(!isActive)}
            className={`relative w-14 h-8 rounded-full transition-all ${
              isActive ? 'bg-orange-500' : 'bg-slate-300'
            } ${!isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                isActive ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>
        {!isSuperAdmin && (
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Main/Super Admin only</p>
        )}
      </div>

      {isActive && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center">
              <AlertTriangle size={18} className="text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-orange-500">Maintenance Live</p>
              <p className="text-sm font-bold text-orange-700 mt-1">System paused for Staff Admins & users</p>
              <p className="text-xs text-orange-600 mt-1">Controls are synchronized across sidebar indicator and header status badge.</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-3">Actions</p>

        {hasActiveTimer && (
          <div className="mb-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-orange-700">
              <Clock3 size={14} />
              <span className="text-xs font-bold uppercase tracking-wider">Time Remaining</span>
            </div>
            <span className="text-sm font-black text-orange-600 tracking-wider">{formatRemaining(remaining)}</span>
          </div>
        )}

        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">Duration</p>
        <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
          <input
            type="number"
            min={1}
            max={999}
            step={1}
            inputMode="numeric"
            value={durationValue}
            onChange={handleValueChange}
            disabled={!canSet}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <select
            value={durationUnit}
            onChange={(e) => setDurationUnit(e.target.value)}
            disabled={!canSet}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!canSet}
            onClick={() => onSetTime(durationValue, durationUnit)}
            className="h-11 rounded-xl border border-orange-300 text-orange-600 bg-white font-bold text-sm hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Wrench size={14} /> SET TIME
          </button>
          <button
            type="button"
            disabled={!canExtend}
            onClick={() => onExtendTime(durationValue, durationUnit)}
            className={`h-11 rounded-xl border font-bold text-sm disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              canExtend
                ? 'border-orange-500 bg-orange-500 text-white hover:bg-orange-600'
                : 'border-slate-200 bg-slate-200 text-slate-500 opacity-70'
            }`}
          >
            <TimerReset size={14} /> EXTEND TIME
          </button>
        </div>

        {!hasActiveTimer && isActive && (
          <p className="mt-3 text-[11px] text-slate-500 font-semibold">Extend disabled until timer is set.</p>
        )}
      </div>
    </div>
  );
};
