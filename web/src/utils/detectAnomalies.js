// utils/detectAnomalies.js — PESO AI
// Flags duplicate transactions (within 24h), expense spikes (>=50%), and unauthorized logins.

const DAY_MS = 24 * 60 * 60 * 1000;

const parseTime = (t) => {
  if (!t) return null;
  const d = new Date(t);
  return isNaN(d) ? null : d.getTime();
};

const normalizeIp = (ip) => String(ip || '').trim();

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const detectAnomalies = ({
  transactions = [],
  expensesTrend = [],
  logins = [],
  authorizedIps = [],
} = {}) => {
  const duplicateTransactions = [];
  const expenseSpikes = [];
  const unauthorizedLogins = [];

  // Duplicate transactions within 24 hours (same user + amount + category/merchant)
  const txSorted = [...transactions].sort((a, b) => (parseTime(a.created_at || a.timestamp || a.date) || 0) - (parseTime(b.created_at || b.timestamp || b.date) || 0));
  const lastByKey = new Map();
  txSorted.forEach(tx => {
    const t = parseTime(tx.created_at || tx.timestamp || tx.date);
    if (!t) return;
    const key = [
      tx.user_id || tx.userId || tx.account_id || 'unknown',
      toNumber(tx.amount).toFixed(2),
      (tx.category || tx.merchant || tx.description || '').toLowerCase().slice(0, 64),
    ].join('|');

    const prev = lastByKey.get(key);
    if (prev && t - prev.time <= DAY_MS) {
      duplicateTransactions.push({ current: tx, previous: prev.tx, deltaMs: t - prev.time });
    }
    lastByKey.set(key, { time: t, tx });
  });

  // Expense spikes (>=50% increase vs previous period)
  for (let i = 1; i < expensesTrend.length; i++) {
    const prev = toNumber(expensesTrend[i - 1]?.avg_expenses ?? expensesTrend[i - 1]?.expenses);
    const curr = toNumber(expensesTrend[i]?.avg_expenses ?? expensesTrend[i]?.expenses);
    if (prev > 0 && curr >= prev * 1.5) {
      expenseSpikes.push({
        label: expensesTrend[i]?.label ?? `#${i + 1}`,
        prev,
        curr,
        changePct: Number((((curr - prev) / prev) * 100).toFixed(1)),
      });
    }
  }

  // Unauthorized logins
  const allowlist = new Set((authorizedIps || []).map(x => normalizeIp(x.ip || x)));
  logins.forEach(l => {
    const ip = normalizeIp(l.ip || l.ip_address || l.ipAddress);
    if (ip && allowlist.size > 0 && !allowlist.has(ip)) {
      unauthorizedLogins.push(l);
    }
  });

  const hasAnomalies = duplicateTransactions.length > 0 || expenseSpikes.length > 0 || unauthorizedLogins.length > 0;

  return {
    hasAnomalies,
    duplicateTransactions,
    expenseSpikes,
    unauthorizedLogins,
    summary: {
      duplicates: duplicateTransactions.length,
      spikes: expenseSpikes.length,
      unauthorizedLogins: unauthorizedLogins.length,
    },
  };
};
