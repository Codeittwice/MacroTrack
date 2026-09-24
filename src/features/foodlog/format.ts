/** Number/label formatting helpers for the food log page. */

export function fmtKcal(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}

/** Grams: 0 decimals, or 1 decimal when < 10 (dropping a trailing .0). */
export function fmtG(v: number): string {
  if (Math.abs(v) < 10) {
    const r = Math.round(v * 10) / 10;
    return r.toFixed(1).replace(/\.0$/, '');
  }
  return Math.round(v).toLocaleString('en-US');
}

const PLAIN_LABELS = new Set(['g', 'ml', '100 g', '100 ml']);

/** Human amount line for a log entry row. */
export function fmtAmount(grams: number, servingLabel?: string): string {
  if (servingLabel && !PLAIN_LABELS.has(servingLabel.trim().toLowerCase())) {
    return `${servingLabel} (${fmtG(grams)} g)`;
  }
  return `${fmtG(grams)} g`;
}
