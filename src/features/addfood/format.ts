/** Number formatting helpers for the Add food sheet (mirrors src/features/foodlog/format.ts). */

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
