/**
 * Pure intake/adherence statistics derived from daily kcal totals.
 */
import type { DateKey } from '@/db/types';
import { addDays, today as todayFn } from '@/lib/utils/date';

/**
 * % (0..100, unrounded) of days whose kcal is within ±10% of target (inclusive).
 * Returns null when `daily` is empty or `target` is not a finite number > 0.
 */
export function adherence(daily: { kcal: number }[], target: number): number | null {
  if (daily.length === 0) return null;
  if (!Number.isFinite(target) || target <= 0) return null;
  const lo = target * 0.9;
  const hi = target * 1.1;
  let hits = 0;
  for (const d of daily) {
    if (!Number.isFinite(d.kcal)) continue;
    if (d.kcal >= lo && d.kcal <= hi) hits++;
  }
  return (hits / daily.length) * 100;
}

/**
 * Mean kcal over the LOGGED days whose date falls in the last `days` calendar days ending
 * `today` (inclusive: [addDays(today, -(days-1)), today]). Days without entries are ignored
 * (not zero). Returns null when no logged days fall in the window or days <= 0.
 */
export function averageIntake(
  daily: { date: DateKey; kcal: number }[],
  days: number,
  today: DateKey = todayFn(),
): number | null {
  if (!Number.isFinite(days) || days <= 0) return null;
  const windowStart = addDays(today, -(days - 1));
  let sum = 0;
  let n = 0;
  for (const d of daily) {
    if (!Number.isFinite(d.kcal)) continue;
    if (d.date < windowStart || d.date > today) continue;
    sum += d.kcal;
    n++;
  }
  if (n === 0) return null;
  return sum / n;
}
