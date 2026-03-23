// components/hub/StaffSessionMonitor.jsx — PESO AI
import React, { useEffect, useState } from 'react';

export const StaffSessionMonitor = ({ sessions = [] }) => {
  const [visibleSessions, setVisibleSessions] = useState([]);

  useEffect(() => {
    const staff = (Array.isArray(sessions) ? sessions : []).filter((s) => (s.role || '') === 'Staff Admin');
    setVisibleSessions(staff);
  }, [sessions]);

  return (
    <div className="mb-6 bg-white border border-blue-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">Active Sessions</p>
          <h2 className="text-lg font-bold text-slate-800">Staff Session Monitor</h2>
        </div>
        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded-full">
          {visibleSessions.length} sessions
        </span>
      </div>

      {visibleSessions.length === 0 ? (
        <p className="text-sm text-slate-500">No staff sessions detected.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                {['Staff Admin', 'Device', 'Last Active'].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleSessions.slice(0, 8).map((s, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-bold text-slate-800">{s.name || 'Staff Admin'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.platform || 'Unknown'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {s.lastActive ? new Date(s.lastActive).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
