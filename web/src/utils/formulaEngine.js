export const RISK_THRESHOLDS     = { HIGH: 80,  MEDIUM: 50  };
export const SAVINGS_THRESHOLDS  = { LOW:  10,  HIGH:   30  };
export const SPENDING_THRESHOLDS = { CRITICAL: 40, CAUTION: 25 };

export const computeExpenseRatio = (income, expenses) => {
  const i = Number(income), e = Number(expenses);
  if (!i || isNaN(i) || isNaN(e)) return 0;
  return (e / i) * 100;
};

export const computeRisk = (expense_ratio) => {
  const r = Number(expense_ratio);
  if (isNaN(r))                    return 'Low';
  if (r >= RISK_THRESHOLDS.HIGH)   return 'High';
  if (r >= RISK_THRESHOLDS.MEDIUM) return 'Medium';
  return 'Low';
};

export const computeSavingsRate = (income, expenses) => {
  const i = Number(income), e = Number(expenses);
  if (!i || isNaN(i) || isNaN(e)) return 0;
  return ((i - e) / i) * 100;
};

export const classifySaver = (savings_rate) => {
  const r = Number(savings_rate);
  if (r < 0)                       return 'Negative Saver';
  if (r < SAVINGS_THRESHOLDS.LOW)  return 'Low Saver';
  if (r < SAVINGS_THRESHOLDS.HIGH) return 'Mid Saver';
  return 'High Saver';
};

export const classifySpending = (category_share) => {
  const s = Number(category_share);
  if (isNaN(s))                          return 'Normal';
  if (s >= SPENDING_THRESHOLDS.CRITICAL) return 'Over Limit';
  if (s >= SPENDING_THRESHOLDS.CAUTION)  return 'Caution';
  return 'Normal';
};

/* ── Display helpers ─────────────────────────────────────────── */
export const peso = (v) => {
  const n = Number(v);
  if (!v || isNaN(n)) return '—';
  return n >= 1_000_000 ? `₱${(n / 1_000_000).toFixed(1)}M`
      : n >= 1000       ? `₱${(n / 1000).toFixed(1)}k`
      : `₱${n.toFixed(0)}`;
};

export const pct = (num, den) => {
  const n = Number(num), d = Number(den);
  if (!d || isNaN(n) || isNaN(d)) return 0;
  return Math.round((n / d) * 100);
};