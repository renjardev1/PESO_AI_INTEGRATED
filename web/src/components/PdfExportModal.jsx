import React, { useState, useRef } from 'react';
import { FileText, X, Printer, Download } from 'lucide-react';
import { useClickOutside } from './UIAtoms';
import { PDF_SECTIONS } from '../pdf/pdfHelpers';

const PdfExportModal = ({ open, onClose, onExport, generating }) => {
  const [selected, setSelected] = useState(PDF_SECTIONS.map(s => s.id));
  const panelRef = useRef(null);
  useClickOutside(panelRef, () => { if (!generating) onClose(); });
  if (!open) return null;

  const toggle    = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === PDF_SECTIONS.length ? [] : PDF_SECTIONS.map(s => s.id));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(14,42,71,0.35)', backdropFilter: 'blur(10px)' }}>
      <div ref={panelRef} style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 20, border: '1px solid #E0EEFF', boxShadow: '0 24px 60px rgba(14,42,71,0.12)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px 16px', background: 'linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%)', borderBottom: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #3B82F6, #60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
              <FileText size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#93C5FD' }}>Export Report</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1E3A5F', letterSpacing: '-0.02em' }}>Generate PDF</div>
            </div>
          </div>
          <button onClick={onClose} disabled={generating} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #BFDBFE', background: 'rgba(255,255,255,0.8)', color: '#93C5FD', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px', background: '#FAFCFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8' }}>Choose Sections</span>
            <button onClick={toggleAll} style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
              {selected.length === PDF_SECTIONS.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {PDF_SECTIONS.map(s => {
              const active = selected.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggle(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 12, cursor: 'pointer', border: `1.5px solid ${active ? '#BFDBFE' : '#E2E8F0'}`, background: active ? '#EFF6FF' : '#fff', transition: 'all 0.15s', textAlign: 'left' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? '#1D4ED8' : '#334155' }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500, marginTop: 1 }}>{s.desc}</div>
                  </div>
                  <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: active ? '#3B82F6' : '#fff', border: `2px solid ${active ? '#3B82F6' : '#CBD5E1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {active && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 14, padding: '10px 13px', borderRadius: 10, background: '#F0F9FF', border: '1px solid #BAE6FD', fontSize: 11, color: '#0369A1', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Printer size={12} color="#0EA5E9" />
            PDF is print-ready — A4 format, tabular layout, suitable for meetings &amp; presentations.
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px 18px', borderTop: '1px solid #E0EEFF', background: 'linear-gradient(to bottom, #fff, #F5F9FF)', display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={generating} style={{ padding: '10px 16px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 700, color: '#64748B', cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={() => onExport(selected)}
            disabled={selected.length === 0 || generating}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: selected.length === 0 ? '#E2E8F0' : 'linear-gradient(135deg, #3B82F6, #60A5FA)', color: selected.length === 0 ? '#94A3B8' : '#fff', fontSize: 13, fontWeight: 800, cursor: selected.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: selected.length > 0 ? '0 4px 16px rgba(59,130,246,0.3)' : 'none' }}
          >
            {generating
              ? <><span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Generating…</>
              : <><Download size={13} />Export {selected.length} Section{selected.length !== 1 ? 's' : ''}</>}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default PdfExportModal;
