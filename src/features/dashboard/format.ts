import type { DateKey } from '@/db/types';
import { fromDateKey } from '@/lib/utils/date';

const KG_TO_LB = 2.2046226218;

/** Finite-safe number formatter: returns '—' for non-finite values. */
export function fmt(v: number | undefined | null, digits = 0): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function kcalFmt(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString();
}

export function kgToUnit(kg: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? kg * KG_TO_LB : kg;
}

/** Formats a weight value already converted to the display unit, e.g. "82.4 kg". */
export function weightFmt(kg: number | undefined | null, unit: 'kg' | 'lb'): string {
  if (kg === undefined || kg === null || !Number.isFinite(kg)) return '—';
  return `${fmt(kgToUnit(kg, unit), 1)} ${unit}`;
}

/** Sign-prefixed weight delta, e.g. "-0.4 kg" / "+0.2 kg". */
export function signedWeightFmt(deltaKg: number | undefined | null, unit: 'kg' | 'lb'): string {
  if (deltaKg === undefined || deltaKg === null || !Number.isFinite(deltaKg)) return '—';
  const v = kgToUnit(deltaKg, unit);
  const sign = v > 0 ? '+' : '';
  return `${sign}${fmt(v, 1)} ${unit}`;
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formattedToday(now: Date = new Date()): string {
  return now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatGoalDate(date: DateKey, today: DateKey): string {
  const d = fromDateKey(date);
  const t = fromDateKey(today);
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === t.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' };
  return d.toLocaleDateString(undefined, opts);
}
