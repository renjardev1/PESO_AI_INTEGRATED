// components/GlobalConfirmModal.jsx  –  PESO AI
// Reusable modal for confirmations + toast notifications
// Usage: import { useConfirm, ConfirmModal, Toast } from './GlobalConfirmModal'

import React, { useState, useCallback } from 'react';
import { X, AlertTriangle, ShieldOff, UserX, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';

// ══════════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════════
export const Toast = ({ toasts }) => (
  <>
    <style>{`
      @keyframes toastIn {
        0%   { opacity: 0; transform: translateX(40px) scale(0.96); }
        70%  { transform: translateX(-4px) scale(1.01); }
        100% { opacity: 1; transform: translateX(0) scale(1); }
      }
      @keyframes toastOut {
        to { opacity: 0; transform: translateX(40px) scale(0.96); }
      }
    `}</style>
    <div className="fixed top-6 right-6 z-[300] flex flex-col gap-2.5 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`relative pointer-events-auto w-[320px] max-w-[85vw] overflow-hidden
            rounded-2xl border shadow-xl backdrop-blur-xl px-4 py-3 flex items-start gap-3
            ${t.type === 'success' ? 'bg-emerald-50/80 border-emerald-200 text-slate-800 shadow-emerald-100/60'
            : t.type === 'error'   ? 'bg-rose-50/80 border-rose-200   text-slate-800 shadow-rose-100/60'
            : t.type === 'warning' ? 'bg-amber-50/80 border-amber-200  text-slate-800 shadow-amber-100/60'
            :                        'bg-blue-50/80 border-blue-200   text-slate-800 shadow-blue-100/60'}`}
          style={{ animation: 'toastIn 0.4s cubic-bezier(0.34,1.4,0.64,1) forwards' }}
        >
          <span className={`absolute left-0 top-0 h-full w-1.5
            ${t.type === 'success' ? 'bg-emerald-400'
            : t.type === 'error'   ? 'bg-rose-400'
            : t.type === 'warning' ? 'bg-amber-400'
            :                        'bg-blue-400'}`}
          />
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0
            ${t.type === 'success' ? 'bg-emerald-100 text-emerald-700'
            : t.type === 'error'   ? 'bg-rose-100 text-rose-700'
            : t.type === 'warning' ? 'bg-amber-100 text-amber-700'
            :                        'bg-blue-100 text-blue-700'}`}>
            <span className="text-[13px] font-black">
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '!' : 'i'}
            </span>
          </div>
          <div className="text-[12.5px] font-semibold leading-snug">
            {t.message}
          </div>
        </div>
      ))}
    </div>
  </>
);

// ══════════════════════════════════════════════════════════════
//  CONFIRM MODAL VARIANTS CONFIG
// ══════════════════════════════════════════════════════════════
const VARIANTS = {
  logout: {
    icon:        <LogOut size={26} />,
    iconBg:      'bg-slate-900',
    iconColor:   'text-white',
    confirmBg:   'bg-slate-900 hover:bg-slate-700',
    confirmText: 'Sign Out',
    badgeBg:     'bg-slate-100 text-slate-700 border-slate-200',
  },
  switch: {
    icon:        <RefreshCw size={26} />,
    iconBg:      'bg-blue-600',
    iconColor:   'text-white',
    confirmBg:   'bg-blue-600 hover:bg-blue-700',
    confirmText: 'Switch Account',
    badgeBg:     'bg-blue-50 text-blue-700 border-blue-200',
  },
  disable: {
    icon:        <UserX size={26} />,
    iconBg:      'bg-rose-500',
    iconColor:   'text-white',
    confirmBg:   'bg-rose-500 hover:bg-rose-600',
    confirmText: 'Yes, Disable',
    badgeBg:     'bg-rose-50 text-rose-700 border-rose-200',
  },
  enable: {
    icon:        <ShieldCheck size={26} />,
    iconBg:      'bg-emerald-500',
    iconColor:   'text-white',
    confirmBg:   'bg-emerald-500 hover:bg-emerald-600',
    confirmText: 'Yes, Enable',
    badgeBg:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  maintenance: {
    icon:        <ShieldOff size={26} />,
    iconBg:      'bg-rose-500',
    iconColor:   'text-white',
    confirmBg:   'bg-rose-500 hover:bg-rose-600',
    confirmText: 'Activate',
    badgeBg:     'bg-rose-50 text-rose-700 border-rose-200',
  },
};

// ══════════════════════════════════════════════════════════════
//  CONFIRM MODAL
// ══════════════════════════════════════════════════════════════
export const ConfirmModal = ({ modal, onConfirm, onCancel }) => {
  if (!modal) return null;
  const v = VARIANTS[modal.variant] || VARIANTS.logout;

  return (
    <>
      <style>{`
        @keyframes backdropIn { from { opacity:0 } to { opacity:1 } }
        @keyframes cardIn {
          0%   { opacity:0; transform: scale(0.88) translateY(16px); }
          70%  { transform: scale(1.02) translateY(-2px); }
          100% { opacity:1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
          style={{ animation: 'backdropIn 0.25s ease forwards' }}
          onClick={onCancel}
        />

        {/* Card */}
        <div
          className="relative bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-[360px] border border-white/60"
          style={{
            animation: 'cardIn 0.38s cubic-bezier(0.34,1.3,0.64,1) forwards',
            boxShadow: '0 32px 80px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)',
          }}
        >
          {/* Close */}
          <button
            onClick={onCancel}
            className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all duration-200"
          >
            <X size={15} />
          </button>

          {/* Icon */}
          <div className={`w-[72px] h-[72px] rounded-[22px] flex items-center justify-center mx-auto mb-6 shadow-lg ${v.iconBg}`}>
            <span className={v.iconColor}>{v.icon}</span>
          </div>

          {/* Title + Subtitle */}
          <h3 className="text-[1.35rem] font-black text-slate-900 text-center tracking-tight leading-tight mb-1.5">
            {modal.title}
          </h3>
          <p className="text-slate-400 text-[13px] text-center leading-relaxed mb-4">
            {modal.subtitle}
          </p>

          {/* Subject badge (e.g. username) */}
          {modal.subject && (
            <div className={`mx-auto w-fit px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest border mb-7 ${v.badgeBg}`}>
              {modal.subject}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3.5 rounded-2xl border-2 border-slate-100 text-slate-500 font-bold text-sm hover:bg-slate-50 hover:border-slate-200 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-3.5 rounded-2xl font-bold text-sm text-white transition-all duration-200 shadow-lg ${v.confirmBg}`}
            >
              {v.confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ══════════════════════════════════════════════════════════════
//  useConfirm HOOK  — handles modal + toast state together
// ══════════════════════════════════════════════════════════════
export const useConfirm = () => {
  const [modal,  setModal]  = useState(null);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const confirm = useCallback((config) => {
    return new Promise((resolve) => {
      setModal({ ...config, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (modal?.resolve) modal.resolve(true);
    setModal(null);
  }, [modal]);

  const handleCancel = useCallback(() => {
    if (modal?.resolve) modal.resolve(false);
    setModal(null);
  }, [modal]);

  return { modal, toasts, confirm, showToast, handleConfirm, handleCancel };
};

export default { ConfirmModal, Toast, useConfirm };
