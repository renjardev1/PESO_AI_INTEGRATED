// components/hub/HubModal.jsx — PESO AI
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, ZoomIn, Move } from 'lucide-react';

// ─── Hub Modal Shell ─────────────────────────────────────────
export const HubModal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
    <div
      className="relative bg-white w-full max-w-[820px] rounded-[2.5rem] shadow-2xl p-8 overflow-hidden"
      style={{ animation: 'hubIn .25s cubic-bezier(.22,1,.36,1) both' }}
    >
      <style>{`@keyframes hubIn{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:none}}`}</style>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-black text-slate-900 tracking-tight flex-1">{title}</h3>
        <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

// ─── Image Cropper ────────────────────────────────────────────
export const ImageCropper = ({ src, onDone, onCancel }) => {
  const WRAP = 300;
  const imgRef       = useRef();
  const [pos,    setPos]    = useState({ x: 70, y: 70 });
  const [size,   setSize]   = useState(160);
  const [drag,   setDrag]   = useState(null);
  const [loaded, setLoaded] = useState(false);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const onMouseDown = (e, mode) => {
    e.preventDefault();
    setDrag({ mode, ox: e.clientX, oy: e.clientY, sx: pos.x, sy: pos.y, sz: size });
  };

  const onMouseMove = useCallback(e => {
    if (!drag) return;
    const dx = e.clientX - drag.ox, dy = e.clientY - drag.oy;
    if (drag.mode === 'move')
      setPos({ x: clamp(drag.sx + dx, 0, WRAP - size), y: clamp(drag.sy + dy, 0, WRAP - size) });
    else {
      const ns = clamp(drag.sz + Math.min(dx, dy), 60, WRAP - Math.max(drag.sx, drag.sy));
      setSize(ns);
    }
  }, [drag, size]);

  const onMouseUp = useCallback(() => setDrag(null), []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const handleCrop = () => {
    const img = imgRef.current;
    if (!img) return;
    const scX = img.naturalWidth / img.offsetWidth;
    const scY = img.naturalHeight / img.offsetHeight;
    const offX = (WRAP - img.offsetWidth) / 2;
    const offY = (WRAP - img.offsetHeight) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 200;
    canvas.getContext('2d').drawImage(
      img,
      clamp((pos.x - offX) * scX, 0, img.naturalWidth),
      clamp((pos.y - offY) * scY, 0, img.naturalHeight),
      size * scX, size * scY, 0, 0, 200, 200
    );
    onDone(canvas.toDataURL('image/jpeg', 0.85));
  };

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-slate-600 text-center">
        <Move size={12} className="inline mr-1 text-blue-500" />
        Drag to reposition · corner handle to resize
      </p>
      <div
        className="relative mx-auto bg-slate-200 rounded-2xl overflow-hidden select-none"
        style={{ width: WRAP, height: WRAP }}
      >
        <img
          ref={imgRef} src={src} alt="crop" onLoad={() => setLoaded(true)}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-full max-h-full object-contain"
          draggable={false}
        />
        {loaded && <>
          <svg className="absolute inset-0 pointer-events-none" width={WRAP} height={WRAP}>
            <defs>
              <mask id="cm">
                <rect width={WRAP} height={WRAP} fill="white" />
                <rect x={pos.x} y={pos.y} width={size} height={size} fill="black" />
              </mask>
            </defs>
            <rect width={WRAP} height={WRAP} fill="rgba(0,0,0,0.55)" mask="url(#cm)" />
          </svg>
          <div
            className="absolute border-2 border-white rounded-lg"
            style={{ left: pos.x, top: pos.y, width: size, height: size, cursor: 'grab' }}
            onMouseDown={e => onMouseDown(e, 'move')}
          >
            {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2',
              'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map((cls, i) => (
              <div key={i} className={`absolute ${cls} w-4 h-4 border-white`} />
            ))}
            <div
              className="absolute bottom-0 right-0 w-5 h-5 bg-white rounded-tl-lg cursor-se-resize flex items-center justify-center"
              onMouseDown={e => { e.stopPropagation(); onMouseDown(e, 'resize'); }}
            >
              <ZoomIn size={10} className="text-slate-700" />
            </div>
          </div>
        </>}
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">
          Cancel
        </button>
        <button
          onClick={handleCrop} disabled={!loaded}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
        >
          Crop & Apply
        </button>
      </div>
    </div>
  );
};
