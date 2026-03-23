// components/hub/StrategySimulator.jsx — PESO AI
import React from 'react';
import { TrendingUp, TrendingDown, SlidersHorizontal } from 'lucide-react';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const pctLabel = (v) => `${v > 0 ? '+' : ''}${v}%`;

const SliderRow = ({ label, value, onChange, color, icon }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${color.bg} ${color.border} border`}>
          {icon}
        </span>
        <span className="text-sm font-bold text-slate-800">{label}</span>
      </div>
      <span className={`text-xs font-black px-2 py-1 rounded-full ${color.pill}`}>
        {pctLabel(value)}
      </span>
    </div>
    <input
      type="range"
      min={-40}
      max={40}
      step={5}
      value={value}
      onChange={e => onChange(clamp(Number(e.target.value), -40, 40))}
      className="w-full accent-blue-600"
    />
  </div>
);

export const StrategySimulator = ({ incomeDelta, expenseDelta, onChange }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <SlidersHorizontal size={16} className="text-blue-600" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">What-If Simulator</p>
          <p className="text-sm font-bold text-slate-800">Strategy Simulator</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <SliderRow
          label="Income Adjustment"
          value={incomeDelta}
          onChange={(v) => onChange({ incomeDelta: v, expenseDelta })}
          color={{ bg: 'bg-emerald-50', border: 'border-emerald-100', pill: 'bg-emerald-50 text-emerald-700 border border-emerald-100' }}
          icon={<TrendingUp size={14} className="text-emerald-600" />}
        />
        <SliderRow
          label="Expense Adjustment"
          value={expenseDelta}
          onChange={(v) => onChange({ incomeDelta, expenseDelta: v })}
          color={{ bg: 'bg-rose-50', border: 'border-rose-100', pill: 'bg-rose-50 text-rose-700 border border-rose-100' }}
          icon={<TrendingDown size={14} className="text-rose-600" />}
        />
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Simulation Range</span>
        <span className="text-xs font-semibold text-slate-600">-40% to +40%</span>
      </div>
    </div>
  );
};
