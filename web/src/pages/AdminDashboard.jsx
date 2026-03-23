// pesir/src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users, Activity, Wallet, ArrowDownCircle, PiggyBank,
  TrendingUp, TrendingDown, RefreshCw, Info,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  Tooltip, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer,
} from 'recharts';
import logo from '../assets/logo.png';

import {
  computeExpenseRatio, computeRisk, computeSavingsRate, classifySaver, classifySpending,
  peso, pct,
} from '../utils/formulaEngine';

import { generatePDF } from '../pdf/pdfHelpers';
import { generateDashboardXLSX } from '../pdf/dashboardAnalyticsExport';

import PdfExportModal from '../components/PdfExportModal';
import { EmptyState, Card, Dropdown } from '../components/UIAtoms';
import { useConfirm, ConfirmModal, Toast } from '../components/GlobalConfirmModal';
import { apiFetch } from '../utils/authClient';

const API = '/api/admin';

// ── MASTER DESIGN TOKENS ────────────────────────────────────
const T = {
  blue:    { base: '#3B82F6', bg: '#EFF6FF', light: '#DBEAFE', text: '#1D4ED8' },
  teal:    { base: '#14B8A6', bg: '#F0FDFA', light: '#CCFBF1', text: '#0F766E' },
  emerald: { base: '#10B981', bg: '#ECFDF5', light: '#A7F3D0', text: '#047857' },
  rose:    { base: '#EF4444', bg: '#FFF5F5', light: '#FECACA', text: '#B91C1C' },
  amber:   { base: '#F59E0B', bg: '#FFFBEB', light: '#FDE68A', text: '#D97706' },
  indigo:  { base: '#6366F1', bg: '#EEF2FF', light: '#C7D2FE', text: '#4338CA' },
  violet:  { base: '#7C3AED', bg: '#F5F3FF', light: '#DDD6FE', text: '#5B21B6' },
  pink:    { base: '#EC4899', bg: '#FDF2F8', light: '#FBCFE8', text: '#9D174D' },
  slate:   { base: '#64748B', bg: '#F8FAFC', light: '#E2E8F0', text: '#334155' },

  // Chart line colors — match KPI semantic colors
  income:   '#10B981',  // Emerald Green
  expenses: '#EF4444',  // Rose Red
  savings:  '#F59E0B',  // Amber Gold

  riskHigh: { base: '#EF4444', bg: '#FFF5F5', border: '#FECACA' },
  riskMed:  { base: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  riskLow:  { base: '#10B981', bg: '#F0FDF4', border: '#A7F3D0' },

  surface:    '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  border:     '#F1F5F9',
  borderMid:  '#E2E8F0',
  textBase:   '#0F172A',
  textMid:    '#334155',
  textSub:    '#64748B',
  textMuted:  '#94A3B8',

  radius:   '16px',
  shadow:   '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
  shadowMd: '0 4px 16px rgba(15,23,42,0.08), 0 1px 4px rgba(15,23,42,0.04)',
};

// ── GLOBAL CATEGORY COLOR MAP ────────────────────────────────
// Colors for known categories plus a fixed fallback for any new label.
const CATEGORY_COLOR_MAP = {
  'Bills & Utilities': '#c0392b',
  'Groceries':         '#d44d2a',
  'Shopping':          '#e0622a',
  'Transportation':    '#e8782a',
  'Food & Dining':     '#f0922a',
  'Health':            '#5a8a3c',
  'Entertainment':     '#3a7abf',
};

const CATEGORY_COLOR_CYCLE = [
  '#c0392b', '#d44d2a', '#e0622a', '#e8782a', '#f0922a', '#5a8a3c', '#3a7abf',
];
const CATEGORY_COLOR_FALLBACK = '#b85c1a';

const getCategoryColor = (name, index) => {
  if (!name) return CATEGORY_COLOR_FALLBACK;
  const normalized = name.trim();
  return CATEGORY_COLOR_MAP[normalized]
    ?? CATEGORY_COLOR_CYCLE[index % CATEGORY_COLOR_CYCLE.length]
    ?? CATEGORY_COLOR_FALLBACK;
};

const canonicalCategoryName = (label) => {
  const trimmed = (label ?? '').trim();
  if (!trimmed) return 'Uncategorized';
  if (trimmed === 'Bills') return 'Bills & Utilities';
  if (trimmed === 'Transport') return 'Transportation';
  if (trimmed === 'Food') return 'Food & Dining';
  return trimmed;
};

// ── SAVINGS DISTRIBUTION — Amber-based palette ───────────────
const SAVINGS_BUCKETS = {
  'Negative Saver': { color: '#c04a2a', label: 'Deficit (Negative)', bgLight: '#FFF5F5', border: '#FECACA' },
  'Low Saver':      { color: '#e8a030', label: 'Low (<20% Income)',   bgLight: '#FFFDE7', border: '#FDE68A' },
  'Mid Saver':      { color: '#3a7abf', label: 'Moderate (20–50%)',   bgLight: '#FFFBEB', border: '#FDE68A' },
  'High Saver':     { color: '#5a8a3c', label: 'High (>50% Income)',  bgLight: '#FEF3C7', border: '#FCD34D' },
};
const SAVINGS_LABEL_MAP = {
  'Deficit':        'Negative Saver',
  'Negative Saver': 'Negative Saver',
  'Low (<20%)':     'Low Saver',
  'Low Saver':      'Low Saver',
  'Moderate':       'Mid Saver',
  'Mid Saver':      'Mid Saver',
  'High (>50%)':    'High Saver',
  'High Saver':     'High Saver',
};
const SAVINGS_ORDER = ['Negative Saver', 'Low Saver', 'Mid Saver', 'High Saver'];

const getSavingsConfig = (name) => {
  const key = SAVINGS_LABEL_MAP[name] || name;
  return SAVINGS_BUCKETS[key] || { color: T.textMuted, label: name, bgLight: T.surfaceAlt, border: T.borderMid };
};
const getSavingsColor = (name) => getSavingsConfig(name).color;

const TREND_FILTERS = [
  { label: 'Daily',   value: 'daily'   },
  { label: 'Weekly',  value: 'weekly'  },
  { label: 'Monthly', value: 'monthly' },
];
const RISK_FILTERS = [
  { label: 'All Levels',  value: 'all'    },
  { label: 'High Risk',   value: 'High'   },
  { label: 'Medium Risk', value: 'Medium' },
  { label: 'Low Risk',    value: 'Low'    },
];

const riskColor  = (l) => ({ High: T.riskHigh.base, Medium: T.riskMed.base, Low: T.riskLow.base })[l] ?? T.textMuted;
const riskBg     = (l) => ({ High: T.riskHigh.bg,   Medium: T.riskMed.bg,   Low: T.riskLow.bg   })[l] ?? T.surfaceAlt;
const riskBorder = (l) => ({ High: T.riskHigh.border, Medium: T.riskMed.border, Low: T.riskLow.border })[l] ?? T.borderMid;

const dominantSaverLabel = (dist = []) => {
  if (!Array.isArray(dist) || dist.length === 0) return 'No Saver Data';
  const top = [...dist].sort((a, b) => Number(b.value || 0) - Number(a.value || 0))[0];
  if (!top || Number(top.value || 0) === 0) return 'No Saver Data';
  return getSavingsConfig(top.name).label;
};

// ── CUSTOM CHART TOOLTIP ────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.surface, border: `1.5px solid ${T.borderMid}`, borderRadius: 12, padding: '10px 14px', boxShadow: T.shadowMd, fontFamily: 'Inter, sans-serif', minWidth: 160 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: i < payload.length - 1 ? 5 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: T.textSub }}>{p.name}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: p.color }}>{peso(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

/* ── ADMIN DASHBOARD ── */
const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { modal, toasts, handleConfirm, handleCancel } = useConfirm();
  const [kpis,                setKpis]                = useState(null);
  const [categories,          setCategories]          = useState([]);
  const [allRiskUsers,        setAllRiskUsers]        = useState([]);
  const [trend,               setTrend]               = useState([]);
  const [savingsDist,         setSavingsDist]         = useState([]);
  const [initLoading,         setInitLoading]         = useState(true);
  const [trendLoading,        setTrendLoading]        = useState(false);
  const [lastUpdate,          setLastUpdate]          = useState(null);
  const [trendFilter,         setTrendFilter]         = useState('monthly');
  const [riskFilter,          setRiskFilter]          = useState('all');
  const [showPdf,             setShowPdf]             = useState(false);
  const [pdfGen,              setPdfGen]              = useState(false);
  const [xlsxGen,             setXlsxGen]             = useState(false);
  const [highlightedSection,  setHighlightedSection]  = useState('');
  const [riskVisibilityPulse, setRiskVisibilityPulse] = useState(false);

  const trendRef          = useRef(null);
  const riskRef           = useRef(null);
  const mountedRef        = useRef(false);
  const highlightTimerRef = useRef(null);
  const riskGlowTimerRef  = useRef(null);
  const trendSectionRef   = useRef(null);
  const savingsSectionRef = useRef(null);
  const expenseSectionRef = useRef(null);
  const riskSectionRef    = useRef(null);

  useEffect(() => {
    const params  = new URLSearchParams(location.search);
    const section = params.get('section');
    if (!section || initLoading) return;
    const refMap = { trend: trendSectionRef, savings: savingsSectionRef, expenses: expenseSectionRef, riskUsers: riskSectionRef };
    const ref = refMap[section];
    if (ref) { const t = setTimeout(() => focusSection(section, ref), 300); return () => clearTimeout(t); }
  }, [location.search, initLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBase = useCallback(async (period = 'monthly') => {
    try {
      const [k, c, h, s] = await Promise.all([
        apiFetch(`${API}/kpis`).then(r => r.json()),
        apiFetch(`${API}/top-categories`).then(r => r.json()),
        apiFetch(`${API}/high-risk`).then(r => r.json()),
        apiFetch(`${API}/savings-distribution?period=${period}`).then(r => r.json()),
      ]);
      setKpis(k);

      // Normalize aliases → merge duplicates → sort desc → apply colors
      const rawCategories = Array.isArray(c) ? c : [];
      const merged = new Map();
      rawCategories.forEach(cat => {
        const label = canonicalCategoryName(cat.category);
        const total = Number(cat.total_spent ?? cat.total ?? 0);
        if (merged.has(label)) {
          const existing = merged.get(label);
          merged.set(label, {
            ...existing,
            total_spent: Number(existing.total_spent || 0) + total,
          });
        } else {
          merged.set(label, { ...cat, category: label, total_spent: total });
        }
      });
      const sorted = Array.from(merged.values()).sort((a, b) => Number(b.total_spent || 0) - Number(a.total_spent || 0));
      setCategories(sorted.map((cat, i) => ({
        ...cat,
        color_hex: getCategoryColor(cat.category, i),
      })));

      setAllRiskUsers((Array.isArray(h) ? h : []).map(u => {
        const ratio = Number(u.expense_ratio) || computeExpenseRatio(u.total_income, u.total_expenses);
        return { ...u, expense_ratio: isNaN(ratio) ? 0 : ratio, risk_level: computeRisk(ratio) };
      }));

      const rawS = Array.isArray(s) ? s : [];
      let processed = [];
      if (rawS.every(d => 'value' in d && 'name' in d)) {
        processed = rawS.map(item => ({ ...item, color: getSavingsColor(item.name) }));
      } else {
        const counts = { 'Negative Saver': 0, 'Low Saver': 0, 'Mid Saver': 0, 'High Saver': 0 };
        rawS.forEach(u => { const sr = computeSavingsRate(u.total_income, u.total_expenses); counts[classifySaver(sr)]++; });
        processed = Object.entries(counts).map(([name, value]) => ({ name, value, color: getSavingsColor(name) }));
      }
      processed.sort((a, b) => {
        const ai = SAVINGS_ORDER.indexOf(SAVINGS_LABEL_MAP[a.name] || a.name);
        const bi = SAVINGS_ORDER.indexOf(SAVINGS_LABEL_MAP[b.name] || b.name);
        return ai - bi;
      });
      setSavingsDist(processed);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (e) { console.error('Base fetch error:', e); }
  }, []);

  const fetchTrend = useCallback(async (period) => {
    setTrendLoading(true);
    try {
      const t = await apiFetch(`${API}/monthly-trend?period=${period}`).then(r => r.json());
      setTrend(Array.isArray(t) ? t : []);
    } catch (e) { console.error('Trend fetch error:', e); }
    setTrendLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      setInitLoading(true);
      await Promise.all([fetchBase('monthly'), fetchTrend('monthly')]);
      setInitLoading(false);
    };
    init();
  }, [fetchBase, fetchTrend]);

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    fetchTrend(trendFilter);
    fetchBase(trendFilter);
  }, [trendFilter, fetchTrend, fetchBase]);

  const handleRefresh = async () => {
    setInitLoading(true);
    await Promise.all([fetchBase(trendFilter), fetchTrend(trendFilter)]);
    setInitLoading(false);
  };

  const handleExportPdf = async (selected) => {
    setPdfGen(true);
    try {
      if (selected.length > 0)
        await generatePDF(selected, { kpis, allRiskUsers, trendFilter, trend, savingsDist, categories }, logo);
    } catch (e) { console.error('PDF error:', e); }
    setPdfGen(false); setShowPdf(false);
  };

  const handleExportXLSX = async () => {
    setXlsxGen(true);
    const exportSavingsDist = Array.isArray(savingsDist) && savingsDist.some((d) => Number(d?.value || 0) > 0)
      ? savingsDist
      : (() => {
          const counts = { 'Deficit': 0, 'Low (<20%)': 0, 'Moderate': 0, 'High (>50%)': 0 };
          (Array.isArray(allRiskUsers) ? allRiskUsers : []).forEach((u) => {
            const sr = computeSavingsRate(u.total_income, u.total_expenses);
            const bucket = classifySaver(sr);
            if (bucket === 'Negative Saver') counts['Deficit'] += 1;
            else if (bucket === 'Low Saver') counts['Low (<20%)'] += 1;
            else if (bucket === 'Mid Saver') counts['Moderate'] += 1;
            else if (bucket === 'High Saver') counts['High (>50%)'] += 1;
          });
          return Object.entries(counts).map(([name, value]) => ({ name, value }));
        })();
    try { await generateDashboardXLSX({ kpis, allRiskUsers, trendFilter, trend, savingsDist: exportSavingsDist, categories }); }
    catch (e) { console.error('Excel export error:', e); }
    setXlsxGen(false);
  };

  const focusSection = useCallback((key, ref) => {
    if (!ref?.current) return;
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHighlightedSection(key);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedSection(''), 2200);
  }, []);

  useEffect(() => () => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    if (riskGlowTimerRef.current)  clearTimeout(riskGlowTimerRef.current);
  }, []);

  useEffect(() => {
    if (!riskSectionRef.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setRiskVisibilityPulse(false);
      requestAnimationFrame(() => setRiskVisibilityPulse(true));
      if (riskGlowTimerRef.current) clearTimeout(riskGlowTimerRef.current);
      riskGlowTimerRef.current = setTimeout(() => setRiskVisibilityPulse(false), 2000);
    }, { threshold: 0.35 });
    observer.observe(riskSectionRef.current);
    return () => observer.disconnect();
  }, []);

  const filteredRisk = riskFilter === 'all' ? allRiskUsers : allRiskUsers.filter(u => u.risk_level === riskFilter);
  const riskCount    = (level) => allRiskUsers.filter(u => u.risk_level === level).length;
  const top6 = (() => {
    const base = categories
      .filter((c) => Number(c.total_spent || 0) > 0)
      .slice(0, 6);
    const groceries = categories.find((c) => c.category === 'Groceries');
    if (!groceries) return base;
    if (base.some((c) => c.category === 'Groceries')) return base;
    return [...base, groceries];
  })();
  const top6Total    = top6.reduce((s, c) => s + Number(c.total_spent || 0), 0);
  const fullName     = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ') || '—';
  const avatarFallback = (name) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=E2E8F0&color=334155`;
  const riskAvatarSrc = (u) => u.avatar_url || u.profile_picture || avatarFallback(fullName(u));
  const trendGradientStops = [
    ['gInc', T.income],
    ['gExp', T.expenses],
  ];
  const savingsTrend = {
    line: '#3a7abf',
    area: 'rgba(58,122,191,0.08)',
    point: '#3a7abf',
  };

  const sectionGlowStyle = (key) => highlightedSection === key ? {
    boxShadow: `0 0 0 2px ${T.indigo.light}, 0 20px 40px rgba(99,102,241,0.12)`,
    borderColor: T.indigo.light,
  } : {};

  // KPI Cards — semantic financial colors, no bottom accent bar
  const kpiCards = [
    { title: 'Total Users',   value: kpis?.total_users ?? '—',    icon: <Users size={16}/>,          color: T.slate,   trend: null,   tooltip: 'View all users →',            target: () => navigate('/admin/users', { state: { filter: 'All' } }) },
    { title: 'Active Users',  value: `${kpis?.pct_active ?? 0}%`, icon: <Activity size={16}/>,       color: T.emerald, trend: 'up',   tooltip: 'View active users →',         target: () => navigate('/admin/users', { state: { filter: 'Active' } }) },
    { title: 'Avg. Income',   value: peso(kpis?.avg_income),      icon: <Wallet size={16}/>,         color: T.emerald, trend: 'up',   tooltip: 'View financial trend ↓',      target: () => focusSection('trend', trendSectionRef) },
    { title: 'Avg. Expenses', value: peso(kpis?.avg_expenses),    icon: <ArrowDownCircle size={16}/>,color: T.rose,    trend: 'down', tooltip: 'View top spending ↓',         target: () => focusSection('expenses', expenseSectionRef) },
    { title: 'Avg. Savings',  value: peso(kpis?.avg_savings),     icon: <PiggyBank size={16}/>,      color: T.amber,   trend: 'up',   tooltip: 'View savings distribution ↓', target: () => focusSection('savings', savingsSectionRef) },
  ];

  if (initLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: T.surfaceAlt }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, border: `3px solid ${T.indigo.light}`, borderTopColor: T.indigo.base, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: T.textMuted, textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>Loading Dashboard</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: T.surfaceAlt, fontFamily: 'Inter, "Plus Jakarta Sans", sans-serif' }}>
      <Toast toasts={toasts} />
      <ConfirmModal modal={modal} onConfirm={handleConfirm} onCancel={handleCancel} />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes glowPulse {
          0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.25); }
          60%  { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
          100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
        }
        @keyframes riskPulse {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.28); }
          60%  { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.borderMid}; border-radius: 99px; }
        .kpi-card {
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          border: 1.5px solid ${T.border}; border-radius: ${T.radius};
          background: ${T.surface}; box-shadow: ${T.shadow};
          position: relative; overflow: hidden;
        }
        .kpi-card:hover { transform: translateY(-4px); box-shadow: ${T.shadowMd}; border-color: ${T.borderMid}; }
        .kpi-card:hover .kpi-hint { opacity: 1; transform: translateY(0); }
        .kpi-hint {
          opacity: 0; transform: translateY(5px);
          transition: opacity 0.18s, transform 0.18s;
          position: absolute; bottom: 12px; right: 14px;
          font-size: 9px; font-weight: 700; letter-spacing: 0.07em;
          color: ${T.textMuted}; text-transform: uppercase; pointer-events: none;
        }
        .section-card {
          background: ${T.surface}; border-radius: ${T.radius};
          border: 1.5px solid ${T.border}; box-shadow: ${T.shadow};
          transition: box-shadow 0.25s, border-color 0.25s;
        }
        .section-glow-active { animation: glowPulse 1.8s ease; }
        .risk-row-glow       { animation: riskPulse 1.4s ease; }
        .ratio-info:hover .risk-ratio-tip { opacity: 1 !important; visibility: visible !important; transform: translateY(0); }
        .risk-ratio-tip { transform: translateY(6px); }
        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 24px;
          align-items: stretch;
        }
        .dashboard-col {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .dashboard-col .section-card {
          height: 100%;
        }
        @media (max-width: 1200px) {
          .dashboard-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 820px) {
          .dashboard-grid { grid-template-columns: 1fr; }
        }
        .action-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 16px; border-radius: 10px;
          border: 1.5px solid ${T.borderMid}; background: ${T.surface};
          color: ${T.textMid}; font-size: 12px; font-weight: 600;
          cursor: pointer; font-family: inherit; box-shadow: ${T.shadow};
          transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
        }
        .action-btn:hover    { background: ${T.surfaceAlt}; border-color: #CBD5E1; box-shadow: ${T.shadowMd}; }
        .action-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
      `}</style>

      <PdfExportModal open={showPdf} onClose={() => setShowPdf(false)} onExport={handleExportPdf} generating={pdfGen} />

      <div style={{ padding: '16px 24px', width: '100%', maxWidth: 2000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 4 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.indigo.text, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Admin Panel</div>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textBase, margin: 0, letterSpacing: '-0.03em', lineHeight: 1.15 }}>System Monitoring</h1>
            {lastUpdate && <p style={{ fontSize: 11, color: T.textMuted, fontWeight: 500, marginTop: 5 }}>Last updated at {lastUpdate}</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="action-btn" onClick={() => setShowPdf(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.rose.base} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>Export PDF
            </button>
            <button type="button" className="action-btn" onClick={handleExportXLSX} disabled={xlsxGen}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.emerald.base} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
              </svg>{xlsxGen ? 'Exporting…' : 'Export Excel'}
            </button>
            <button type="button" className="action-btn" onClick={handleRefresh}><RefreshCw size={13} color={T.textSub} /> Refresh</button>
          </div>
        </div>

        {/* ── KPI CARDS — no bottom accent bar ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          {kpiCards.map(({ title, value, icon, color, trend: tdir, target, tooltip }) => (
            <div key={title} className="kpi-card" onClick={target} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && target()} role="button" tabIndex={0} title={tooltip} style={{ padding: '20px 20px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: color.bg, border: `1.5px solid ${color.light}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: color.base }}>{icon}</span>
                </div>
                {tdir && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: tdir === 'up' ? T.emerald.bg : T.rose.bg, color: tdir === 'up' ? T.emerald.text : T.rose.text, border: `1px solid ${tdir === 'up' ? T.emerald.light : T.rose.light}` }}>
                    {tdir === 'up' ? <TrendingUp size={9}/> : <TrendingDown size={9}/>}
                    {tdir === 'up' ? 'Up' : 'Down'}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>{title}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: color.text, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{value}</div>
              <span className="kpi-hint">{tooltip}</span>
            </div>
          ))}
        </div>

        {/* ── ROW 2: Financial Trend + Savings Distribution ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, alignItems: 'stretch' }}>

          {/* Financial Trend */}
          <div ref={trendSectionRef} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className={`section-card ${highlightedSection === 'trend' ? 'section-glow-active' : ''}`} style={{ padding: '22px 24px', flex: 1, display: 'flex', flexDirection: 'column', ...sectionGlowStyle('trend') }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: T.emerald.bg, border: `1.5px solid ${T.emerald.light}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={15} color={T.emerald.base} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.textBase }}>Financial Trend</div>
                    <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 500 }}>Avg. income, expenses &amp; savings</div>
                  </div>
                  {trendLoading && <div style={{ width: 14, height: 14, border: `2px solid ${T.indigo.light}`, borderTopColor: T.indigo.base, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                </div>
                <Dropdown options={TREND_FILTERS} value={trendFilter} onChange={setTrendFilter} dropRef={trendRef} />
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {trend.length === 0 ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%" minHeight={260}>
                    <AreaChart data={trend} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
                      <defs>
                        {trendGradientStops.map(([id, c]) => (
                          <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={c} stopOpacity={0.15}/>
                            <stop offset="95%" stopColor={c} stopOpacity={0}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke={T.borderMid} strokeOpacity={0.5} horizontal={true} vertical={true} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: T.textMuted, fontWeight: 500, fontFamily: 'Inter, sans-serif' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: T.textMuted, fontFamily: 'Inter, sans-serif' }} axisLine={false} tickLine={false} tickCount={6} tickFormatter={v => `₱${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12, fontWeight: 600, fontFamily: 'Inter, sans-serif' }} formatter={(value) => <span style={{ color: T.textSub }}>{value}</span>} />
                      <Area type="monotone" dataKey="avg_income"   name="Income"   stroke={T.income}   fill="url(#gInc)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: T.surface }} />
                      <Area type="monotone" dataKey="avg_expenses" name="Expenses" stroke={T.expenses} fill="url(#gExp)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: T.surface }} />
                      <Area
                        type="monotone"
                        dataKey="avg_savings"
                        name="Savings"
                        stroke={savingsTrend.line}
                        fill={savingsTrend.area}
                        strokeWidth={2.5}
                        dot={{ r: 4, strokeWidth: 2, stroke: savingsTrend.point, fill: savingsTrend.point }}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: savingsTrend.line, fill: savingsTrend.point }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Savings Distribution */}
          <div ref={savingsSectionRef} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className={`section-card ${highlightedSection === 'savings' ? 'section-glow-active' : ''}`} style={{ padding: '22px 24px', flex: 1, display: 'flex', flexDirection: 'column', ...sectionGlowStyle('savings') }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: T.amber.bg, border: `1.5px solid ${T.amber.light}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PiggyBank size={15} color={T.amber.base} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.textBase }}>Savings Distribution</div>
                  <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 500 }}>By saver classification</div>
                </div>
              </div>
              {savingsDist.every(d => d.value === 0) ? <EmptyState /> : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ height: 220, minHeight: 220, position: 'relative' }}>
                      <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                        <PieChart>
                          <Pie
                            data={[{ name: 'guide', value: 1 }]}
                            dataKey="value"
                            cx="50%"
                            cy="50%"
                            innerRadius="48%"
                            outerRadius="70%"
                            fill="none"
                            stroke={T.borderMid}
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            isAnimationActive={false}
                          />
                          <Pie data={savingsDist} cx="50%" cy="50%" innerRadius="48%" outerRadius="70%" paddingAngle={2} dataKey="value" stroke={T.surface} strokeWidth={3} startAngle={90} endAngle={-270}>
                            {savingsDist.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip
                            formatter={(v, _n, { payload }) => {
                              const total = savingsDist.reduce((s, d) => s + d.value, 0);
                              const cfg   = getSavingsConfig(payload.name);
                              return [`${v} users (${total > 0 ? Math.round((v / total) * 100) : 0}%)`, cfg.label];
                            }}
                            contentStyle={{ borderRadius: 12, fontSize: 11, border: `1.5px solid ${T.borderMid}`, fontFamily: 'Inter, sans-serif', boxShadow: T.shadowMd }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: T.textBase, fontVariantNumeric: 'tabular-nums' }}>{savingsDist.reduce((s, d) => s + Number(d.value || 0), 0)}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Users</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {savingsDist.map((d, i) => {
                        const total = savingsDist.reduce((s, x) => s + x.value, 0);
                        const share = total > 0 ? Math.round((d.value / total) * 100) : 0;
                        const cfg   = getSavingsConfig(d.name);
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 10, background: cfg.bgLight, border: `1px solid ${cfg.border}`, gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0, boxShadow: `0 0 0 2px ${d.color}28` }} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: T.textMid, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.label}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <div style={{ width: 46, height: 4, borderRadius: 99, background: T.borderMid, overflow: 'hidden' }}>
                                <div style={{ width: share + '%', height: '100%', background: d.color, borderRadius: 99 }} />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 800, color: d.color, minWidth: 16, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.value}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, minWidth: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>({share}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── ROW 3: Top Spending + Expense Bar + Risk Users ── */}
        <div className="dashboard-grid">

          {/* Top Spending Categories */}
          <div className="dashboard-col">
            <div className="section-card" style={{ padding: '22px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: T.rose.bg, border: `1.5px solid ${T.rose.light}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowDownCircle size={15} color={T.rose.base} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.textBase }}>Top Spending Categories</div>
                  <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 500 }}>Share of total spend per category</div>
                </div>
              </div>
              <div style={{ height: 1, background: T.border, margin: '14px 0' }} />
              <div style={{ flex: 1, minHeight: 0 }}>
                {top6.length === 0 ? <EmptyState /> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 13, height: '100%', minHeight: 0 }}>
                    {top6.map((c, i) => {
                      const isNoData = Number(c.total_spent || 0) <= 0;
                      const share  = pct(c.total_spent, top6Total);
                      const status = classifySpending(share);
                      const sColor = { 'Over Limit': T.rose.base, 'Caution': T.amber.base, 'Normal': T.emerald.base }[status];
                      const sBg    = { 'Over Limit': T.rose.bg,   'Caution': T.amber.bg,   'Normal': T.emerald.bg   }[status];
                      const sLight = { 'Over Limit': T.rose.light,'Caution': T.amber.light, 'Normal': T.emerald.light}[status];
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 99, background: c.color_hex, flexShrink: 0 }} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: T.textMid }}>{c.category}</span>
                              {isNoData ? (
                                <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: T.surfaceAlt, color: T.textMuted, border: `1px dashed ${T.borderMid}` }}>No data yet</span>
                              ) : status !== 'Normal' && (
                                <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: sBg, color: sColor, border: `1px solid ${sLight}` }}>{status}</span>
                              )}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: c.color_hex }}>{share}%</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 99, background: T.border, overflow: 'hidden', border: isNoData ? `1px dashed ${T.borderMid}` : 'none' }}>
                            <div style={{ height: '100%', borderRadius: 99, width: isNoData ? '0%' : `${share}%`, background: c.color_hex, transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Expense by Category — exact color match via CATEGORY_COLOR_MAP */}
          <div ref={expenseSectionRef} className="dashboard-col">
            <div className={`section-card ${highlightedSection === 'expenses' ? 'section-glow-active' : ''}`} style={{ padding: '22px 24px', flex: 1, display: 'flex', flexDirection: 'column', ...sectionGlowStyle('expenses') }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: T.rose.bg, border: `1.5px solid ${T.rose.light}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingDown size={15} color={T.rose.base} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.textBase }}>Expense by Category</div>
                  <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 500 }}>Total spend per category</div>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {top6.length === 0 ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%" minHeight={230} style={{ width: '100%', height: '100%' }}>
                    <BarChart data={top6} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke={T.borderMid} strokeOpacity={0.4} horizontal={true} vertical={true} />
                      <XAxis type="number" tick={{ fontSize: 9, fill: T.textMuted, fontFamily: 'Inter, sans-serif' }} axisLine={false} tickLine={false} tickFormatter={v => `₱${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} tickCount={5} />
                      <YAxis type="category" dataKey="category" tick={{ fontSize: 9, fontWeight: 600, fill: T.textSub, fontFamily: 'Inter, sans-serif' }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip
                        formatter={(v, _n, { payload }) => [`${peso(v)}  ·  ${pct(v, top6Total)}%`, 'Spent']}
                        contentStyle={{ borderRadius: 12, border: `1.5px solid ${T.borderMid}`, fontSize: 11, fontFamily: 'Inter, sans-serif', boxShadow: T.shadowMd }}
                      />
                      {/* Bars use same color_hex from CATEGORY_COLOR_MAP — guaranteed match with list */}
                      <Bar dataKey="total_spent" radius={[0, 7, 7, 0]} barSize={12}>
                        {top6.map((c, i) => <Cell key={i} fill={c.color_hex} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Risk Users */}
          <div ref={riskSectionRef} className="dashboard-col">
            <div className={`section-card ${highlightedSection === 'riskUsers' ? 'section-glow-active' : ''}`} style={{ padding: '22px 24px', flex: 1, display: 'flex', flexDirection: 'column', ...sectionGlowStyle('riskUsers') }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: T.rose.bg, border: `1.5px solid ${T.rose.light}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={15} color={T.rose.base} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.textBase }}>
                      Risk Users
                      <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: T.surfaceAlt, color: T.textSub, border: `1px solid ${T.borderMid}`, verticalAlign: 'middle' }}>{filteredRisk.length}</span>
                    </div>
                    <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 500 }}>Classified by expense ratio</div>
                  </div>
                </div>
                <Dropdown options={RISK_FILTERS} value={riskFilter} onChange={setRiskFilter} dropRef={riskRef} />
              </div>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {/* Risk badges — Rose/Amber/Emerald */}
                <div style={{ display: 'flex', gap: 6, margin: '12px 0' }}>
                  {[
                    { level: 'High',   color: T.riskHigh },
                    { level: 'Medium', color: T.riskMed  },
                    { level: 'Low',    color: T.riskLow  },
                  ].map(({ level, color }) => (
                    <button key={level} onClick={() => setRiskFilter(riskFilter === level ? 'all' : level)} style={{ flex: 1, padding: '7px 4px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${riskFilter === level ? color.base : color.border}`, background: riskFilter === level ? color.base : color.bg, color: riskFilter === level ? '#fff' : color.base, fontSize: 10, fontWeight: 700, transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, fontFamily: 'inherit' }}>
                      <span style={{ fontSize: 15, fontWeight: 800 }}>{riskCount(level)}</span>
                      <span style={{ opacity: 0.85 }}>{level}</span>
                    </button>
                  ))}
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  {filteredRisk.length === 0
                    ? <EmptyState msg={`No ${riskFilter === 'all' ? '' : riskFilter + ' '}risk users`} />
                    : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        {filteredRisk.map(u => {
                          const lvlColor  = riskColor(u.risk_level);
                          const lvlBg     = riskBg(u.risk_level);
                          const lvlBorder = riskBorder(u.risk_level);
                          return (
                            <div key={`${u.user_id}-${riskVisibilityPulse ? 'g' : 'i'}`} className={u.risk_level === 'High' && riskVisibilityPulse ? 'risk-row-glow' : ''} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: lvlBg, border: `1.5px solid ${lvlBorder}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {/* Circular avatar — color synced to risk level */}
                                <img
                                  src={riskAvatarSrc(u)}
                                  alt={fullName(u)}
                                  style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, objectFit: 'cover', boxShadow: `0 0 0 2px ${lvlColor}28` }}
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = avatarFallback(fullName(u));
                                  }}
                                />
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: T.textMid, lineHeight: 1.3 }}>{fullName(u)}</div>
                                  <div style={{ fontSize: 9.5, color: T.textMuted, lineHeight: 1.3 }}>{u.email}</div>
                                </div>
                              </div>
                              {/* Right-justified percentage + risk badge */}
                              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: lvlColor, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
                                    {Number(u.expense_ratio).toFixed(1)}%
                                  </div>
                                  <div className="ratio-info" style={{ position: 'relative' }}>
                                    <Info size={12} color={T.textMuted} />
                                    <div style={{ position: 'absolute', right: 0, top: '120%', width: 250, background: T.surface, border: `1px solid ${T.borderMid}`, borderRadius: 10, boxShadow: T.shadowMd, padding: '8px 9px', zIndex: 30, opacity: 0, visibility: 'hidden', pointerEvents: 'none', transition: 'all 0.15s' }} className="risk-ratio-tip">
                                      <div style={{ fontSize: 9.5, color: T.textSub, lineHeight: 1.35 }}>
                                        Expense Ratio = Total Expenses ÷ Total Income × 100.
                                      </div>
                                      <div style={{ fontSize: 9.5, color: T.textSub, lineHeight: 1.35, marginTop: 4 }}>
                                        A ratio above 100% means the user is spending more than they earn.
                                      </div>
                                      <div style={{ height: 1, background: T.border, margin: '7px 0' }} />
                                      <div style={{ fontSize: 9.5, color: T.textMid, lineHeight: 1.45 }}>
                                        <div>Total Income: {peso(u.total_income)}</div>
                                        <div>Total Expenses: {peso(u.total_expenses)}</div>
                                        <div>Ratio: {Number(u.expense_ratio).toFixed(1)}%</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div style={{ fontSize: 8, fontWeight: 800, color: lvlColor, textTransform: 'uppercase', letterSpacing: '0.08em', background: lvlBg, border: `1px solid ${lvlBorder}`, borderRadius: 99, padding: '1px 6px', display: 'inline-block', marginTop: 2 }}>
                                  {u.risk_level}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
