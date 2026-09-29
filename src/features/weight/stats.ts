/**
 * Pure helpers for the Weight page stat cards. Kept dependency-free (no DB, no React) so they
 * are trivial to unit test.
 */
import type { DateKey } from '@/db/types';
import type { DailyPoint } from '@/lib/nutrition';
import { addDays, daysBetween } from '@/lib/utils/date';
import type { GoalType } from '@/db/types';

/**
 * Change in trend weight between the latest point and the point `days` before it (found by
 * exact date match, walking back from the latest date). Returns undefined when there isn't a
 * point far enough back (or the trend is empty).
 */
export function trendChangeOverDays(trend: DailyPoint[], days: number): number | undefined {
  if (trend.length === 0) return undefined;
  const latest = trend[trend.length - 1];
  const targetDate = addDays(latest.date, -days);
  const byDate = new Map(trend.map((p) => [p.date, p.value]));
  const past = byDate.get(targetDate);
  if (past === undefined) return undefined;
  return latest.value - past;
}

/**
 * Average weekly rate of change over the whole trend: (last - first) / (days / 7). Returns
 * undefined when there are fewer than 7 days between the first and last point.
 */
export function averageWeeklyRate(trend: DailyPoint[]): number | undefined {
  if (trend.length < 2) return undefined;
  const first = trend[0];
  const last = trend[trend.length - 1];
  const days = daysBetween(first.date, last.date);
  if (days < 7) return undefined;
  return ((last.value - first.value) / days) * 7;
}

export interface TrendExtreme {
  value: number;
  date: DateKey;
}

export interface TrendExtremes {
  lowest: TrendExtreme;
  highest: TrendExtreme;
}

/** Lowest and highest trend values (with their dates). Returns undefined for an empty trend. */
export function trendExtremes(trend: DailyPoint[]): TrendExtremes | undefined {
  if (trend.length === 0) return undefined;
  let lowest = trend[0];
  let highest = trend[0];
  for (const p of trend) {
    if (p.value < lowest.value) lowest = p;
    if (p.value > highest.value) highest = p;
  }
  return {
    lowest: { value: lowest.value, date: lowest.date },
    highest: { value: highest.value, date: highest.date },
  };
}

/**
 * Whether a weekly rate of change is moving the user toward their goal.
 * - If `goalWeightKg` is set: toward = sign(rate) matches sign(goalWeightKg - currentTrendKg).
 * - Otherwise falls back to the profile's goal type: 'lose' -> rate < 0 is good,
 *   'gain' -> rate > 0 is good, 'maintain' -> |rate| <= 0.1 kg/wk is good.
 * Rates with |rate| < 0.05 kg/wk are treated as flat -> 'flat' (neither good nor bad).
 * Returns undefined when inputs are missing/non-finite.
 */
export type ToWardGoal = 'toward' | 'away' | 'flat';

export function isTowardGoal(
  rateKg: number,
  currentTrendKg: number | undefined,
  goalWeightKg: number | undefined,
  goalType: GoalType | undefined,
): ToWardGoal | undefined {
  if (!Number.isFinite(rateKg)) return undefined;
  if (Math.abs(rateKg) < 0.05) return 'flat';

  if (Number.isFinite(goalWeightKg) && Number.isFinite(currentTrendKg)) {
    const diff = (goalWeightKg as number) - (currentTrendKg as number);
    if (Math.abs(diff) < 0.05) return 'flat';
    return Math.sign(rateKg) === Math.sign(diff) ? 'toward' : 'away';
  }

  if (!goalType) return undefined;
  if (goalType === 'lose') return rateKg < 0 ? 'toward' : 'away';
  if (goalType === 'gain') return rateKg > 0 ? 'toward' : 'away';
  // maintain
  return Math.abs(rateKg) <= 0.1 ? 'toward' : 'away';
}
