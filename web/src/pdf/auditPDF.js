/* ══════════════════════════════════════════════════════════════
   auditPDF.js — PESO AI v1 (Fixed Layout)
   ───────────────────────────────────────────────────────────── */
import {
  loadjsPDF,
  getLogoBase64,
  PT,
  ptx,
  pguard,
  makeCur,
  CW_PDF,
  drawPDFHeader,
  stampPDFFooters,
  drawPDFSectionBar,
  drawPDFTableHeader,
  drawPDFStatCards,
} from './pdfHelpers';

const PH     = 841.89;
const ML     = 36;
const CW     = CW_PDF;
const ROW_H  = 26;   // slightly taller rows for readability
const CELL_P = 7;

/* ── Timestamp formatter ─────────────────────────────────── */
const fmtTime = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 19).replace('T', ' ');
    return (
      d.toLocaleDateString('en-PH', { day: '2-digit', month: 'short', year: 'numeric' }) +
      '  ' +
      d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
    );
  } catch {
    return String(iso).slice(0, 19).replace('T', ' ');
  }
};

/* ── Safe field getter ───────────────────────────────────── */
const getField = (log, ...keys) => {
  for (const k of keys) {
    if (log[k] != null && log[k] !== '') return String(log[k]);
  }
  return '—';
};

/* ── Action colour map ───────────────────────────────────── */
const actionColor = (text = '') => {
  const t = text.toLowerCase();
  if (/^login/.test(t))               return { bg: PT.greenLt,   tc: PT.green  };
  if (/^logout/.test(t))              return { bg: [226,232,240], tc: PT.textMid };
  if (/(creat|add)/.test(t))         return { bg: PT.indigoLt,   tc: PT.indigo };
  if (/(delet|remov|clear)/.test(t)) return { bg: PT.redLt,      tc: PT.red    };
  if (/(edit|updat|chang)/.test(t))  return { bg: PT.amberLt,    tc: PT.amber  };
  return { bg: PT.offWhite, tc: PT.textMid };
};

/* ══════════════════════════════════════════════════════════
   COLUMN LAYOUT  — wider Action, tighter # / Role / Time
   ══════════════════════════════════════════════════════════ */
const AUDIT_COLS = [
  { label: '#',          w: CW * 0.05 },
  { label: 'Admin Name', w: CW * 0.20 },
  { label: 'Role',       w: CW * 0.12 },
  { label: 'Action',     w: CW * 0.38 }, // wider for long action text
  { label: 'Timestamp',  w: CW * 0.25 },
];
AUDIT_COLS.forEach((col, i) => {
  col.x = ML + AUDIT_COLS.slice(0, i).reduce((s, c) => s + c.w, 0);
});

/* ── Draw action cell with auto-truncating pill ──────────── */
const drawActionCell = (doc, text, col, rowY) => {
  const { bg, tc } = actionColor(text);
  const maxPillW = col.w - CELL_P * 2;
  const pillH    = 15;
  const pillX    = col.x + CELL_P;
  const pillY    = rowY + (ROW_H - pillH) / 2;

  // measure and truncate if needed
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const fullW = doc.getTextWidth(text);
  const label = fullW <= maxPillW - 12
    ? text
    : text.substring(0, Math.floor(text.length * (maxPillW - 12) / fullW) - 1) + '…';

  doc.setFillColor(...bg);
  doc.roundedRect(pillX, pillY, maxPillW, pillH, 3, 3, 'F');
  doc.setDrawColor(...tc);
  doc.setLineWidth(0.5);
  doc.roundedRect(pillX, pillY, maxPillW, pillH, 3, 3, 'S');
  doc.setTextColor(...tc);
  doc.text(label, pillX + 6, pillY + pillH - 4);
};

/* ── Draw table header row ───────────────────────────────── */
const drawHdr = (doc, cur) => {
  doc.setFillColor(...PT.navyDark);
  doc.rect(ML, cur.y, CW, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...PT.white);
  AUDIT_COLS.forEach(col => {
    doc.text(col.label, col.x + CELL_P, cur.y + 15);
  });
  cur.adv(22);
};

/* ── Draw all data rows ──────────────────────────────────── */
const drawAuditRows = (doc, cur, logs) => {
  drawHdr(doc, cur);

  logs.forEach((log, idx) => {
    if (cur.y + ROW_H > PH - 50) {
      doc.addPage();
      cur.y = 48;
      drawHdr(doc, cur);
    }

    const rowBg = idx % 2 === 1 ? PT.bgStripe : PT.white;
    doc.setFillColor(...rowBg);
    doc.rect(ML, cur.y, CW, ROW_H, 'F');
    doc.setDrawColor(...PT.lineGray);
    doc.setLineWidth(0.3);
    doc.line(ML, cur.y + ROW_H, ML + CW, cur.y + ROW_H);

    /* Col 0 — # */
    ptx(doc, 'normal', 7.5, PT.textMuted);
    doc.text(String(idx + 1),
      AUDIT_COLS[0].x + AUDIT_COLS[0].w / 2,
      cur.y + ROW_H - 8,
      { align: 'center' }
    );

    /* Col 1 — Admin Name */
    const adminName = getField(log, 'admin_name', 'admin', 'user', 'user_name', 'name');
    ptx(doc, 'bold', 8, PT.textDark);
    doc.text(adminName.substring(0, 22), AUDIT_COLS[1].x + CELL_P, cur.y + ROW_H - 8);

    /* Col 2 — Role (small pill) */
    const roleVal = getField(log, 'admin_role', 'role', 'user_role');
    const isMain  = /main/i.test(roleVal);
    const rPillW  = AUDIT_COLS[2].w - CELL_P * 2;
    const rPillH  = 14;
    const rPillX  = AUDIT_COLS[2].x + CELL_P;
    const rPillY  = cur.y + (ROW_H - rPillH) / 2;
    const rBg     = isMain ? PT.indigoLt : [241, 245, 249];
    const rTc     = isMain ? PT.indigo   : PT.textMid;
    doc.setFillColor(...rBg);
    doc.roundedRect(rPillX, rPillY, rPillW, rPillH, 3, 3, 'F');
    doc.setDrawColor(...rTc);
    doc.setLineWidth(0.4);
    doc.roundedRect(rPillX, rPillY, rPillW, rPillH, 3, 3, 'S');
    ptx(doc, 'bold', 6.5, rTc);
    doc.text(isMain ? 'Main' : 'Staff', rPillX + rPillW / 2, rPillY + rPillH - 4, { align: 'center' });

    /* Col 3 — Action */
    drawActionCell(doc, getField(log, 'action', 'type'), AUDIT_COLS[3], cur.y);

    /* Col 4 — Timestamp (date on top, time below) */
    const ts     = fmtTime(getField(log, 'created_at', 'timestamp', 'time'));
    const parts  = ts.split('  ');
    ptx(doc, 'normal', 7.5, PT.textMid);
    doc.text(parts[0] || ts, AUDIT_COLS[4].x + CELL_P, cur.y + ROW_H - 14);
    if (parts[1]) {
      ptx(doc, 'normal', 7, PT.textMuted);
      doc.text(parts[1], AUDIT_COLS[4].x + CELL_P, cur.y + ROW_H - 5);
    }

    cur.adv(ROW_H);
  });
};

/* ══════════════════════════════════════════════════════════
   MAIN EXPORT
   ══════════════════════════════════════════════════════════ */
export const generateAuditPDF = async (logs = [], options = {}, logoSrc = null) => {
  await loadjsPDF();
  const logoB64 = logoSrc ? await getLogoBase64(logoSrc) : null;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const cur = makeCur();

  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  const { filter = 'all' } = options;
  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(l =>
        getField(l, 'action', 'type').toLowerCase().includes(filter.toLowerCase())
      );

  cur.y = drawPDFHeader(doc, {
    title:    'Audit Trail Report',
    subtitle: `Full activity log listing · ${filteredLogs.length} Records`,
    dateStr,
    timeStr,
    logoB64,
  });

  drawPDFStatCards(doc, cur, [
    { label: 'Total Logs',  value: logs.length,         color: PT.indigo   },
    { label: 'Filtered',    value: filteredLogs.length, color: PT.teal     },
    { label: 'Report Date', value: now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }), color: PT.navyDark },
  ]);
  cur.adv(30);

  drawPDFSectionBar(doc, cur, 'Activity Log Table');

  if (filteredLogs.length === 0) {
    ptx(doc, 'italic', 9, PT.textMuted);
    doc.text('No records found.', ML + CW / 2, cur.y + 30, { align: 'center' });
  } else {
    drawAuditRows(doc, cur, filteredLogs);
  }

  stampPDFFooters(doc, 'Audit Trail Report', doc.internal.getNumberOfPages());
  doc.save(`Audit_Trail_${now.toISOString().slice(0, 10)}.pdf`);
};