/**
 * Adaptive expenditure (TDEE) estimator.
 *
 * Algorithm (documented here; mirrored in the W1c report):
 * - Rolling window of `windowDays` (default 21) calendar days ending at the last trend date E:
 *   the half-open interval (E - windowDays, E].
 * - A "logged day" is a calendar date inside the window that has BOTH a logged intake entry and
 *   a trend point. Days without an intake log are excluded entirely (never treated as 0 kcal).
 *   Multiple intake entries on the same calendar date (e.g. several meals logged separately) are
 *   merged by SUMMING them into one daily total before anything else runs.
 * - n = number of logged days = ExpenditureResult.daysUsed.
 * - n < 10: not enough data to estimate. Returns round(previous ?? prior) with confidence 'low'
 *   and daysUsed = n (no blending, no cap).
 * - Otherwise, raw TDEE = mean(logged intake) - slope_kg_per_day * KCAL_PER_KG, where
 *   slope_kg_per_day is the OLS (least-squares) slope of the trend weight over the SAME calendar
 *   span as the logged days: from the day before the first logged day (or the first logged day
 *   itself, if there is no earlier trend point) through the last logged day. Using the LS slope
 *   over that whole span (rather than the two endpoint values) is far less sensitive to a single
 *   noisy scale reading than a naive two-point delta, and was verified against the simulator to
 *   produce tighter, less seed-dependent estimates.
 * - Bayesian-style shrinkage toward an anchor while data is sparse: w = n / (n + K), K = 5 (chosen
 *   so that with the 10-day minimum, w ~= 0.67, and w -> 1 as n approaches the window size).
 *   anchor = previous ?? prior. blended = w * raw + (1 - w) * anchor.
 * - Smoothing cap: when `previous` is given, the result cannot move by more than
 *   100 * (daysSincePrevious ?? 7) / 7 kcal away from `previous`. When `previous` is undefined,
 *   no cap is applied (there is nothing to anchor a rate-of-change to).
 * - Confidence: n < 10 'low', 10-15 'medium', n >= 16 'high'.
 */
import type { DateKey } from '@/db/types';
import { addDays, daysBetween } from '@/lib/utils/date';
import { lsSlopePerDay } from './trend';
import { KCAL_PER_KG, type DailyPoint, type ExpenditureInput, type ExpenditureResult } from './types';

/** Bayesian shrinkage strength: smaller K trusts raw data sooner. */
const K = 5;
/** Change cap: kcal per 7 days relative to `previous`. */
const CAP_KCAL_PER_WEEK = 100;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function confidenceFor(n: number): 'low' | 'medium' | 'high' {
  if (n < 10) return 'low';
  if (n <= 15) return 'medium';
  return 'high';
}

interface WindowArgs {
  /** Daily intake, already merged (summed) to one total per calendar date. */
  intake: Map<DateKey, number>;
  /** Full trend series, ascending, one point per calendar day (as produced by trendWeight). */
  trend: DailyPoint[];
  endDate: DateKey;
  windowDays: number;
  prior: number;
  previous?: number;
  daysSincePrevious?: number;
}

/** O(1) lookup of a trend value by date, relying on trend being daily-continuous from trend[0]. */
function trendIndexOf(trend: DailyPoint[], date: DateKey): number {
  if (trend.length === 0) return -1;
  const idx = daysBetween(trend[0].date, date);
  if (idx < 0 || idx >= trend.length) return -1;
  return trend[idx].date === date ? idx : -1;
}

/** Shared estimator core used by both estimateExpenditure and expenditureSeries. */
function computeWindow(args: WindowArgs): ExpenditureResult {
  const { intake, trend, endDate, windowDays, prior, previous, daysSincePrevious } = args;
  const anchor = previous !== undefined && Number.isFinite(previous) ? previous : prior;

  if (trend.length === 0) return { expenditure: Math.round(anchor), confidence: 'low', daysUsed: 0 };

  const windowStart = addDays(endDate, -windowDays); // exclusive
  const loggedDates: DateKey[] = [];
  let sum = 0;
  for (let d = addDays(windowStart, 1); d <= endDate; d = addDays(d, 1)) {
    const kcal = intake.get(d);
    if (kcal === undefined) continue;
    if (trendIndexOf(trend, d) < 0) continue;
    loggedDates.push(d);
    sum += kcal;
  }

  const n = loggedDates.length;
  if (n < 10) return { expenditure: Math.round(anchor), confidence: 'low', daysUsed: n };

  const firstLogged = loggedDates[0];
  const lastLogged = loggedDates[n - 1];
  const dayBefore = addDays(firstLogged, -1);
  const spanStart = trendIndexOf(trend, dayBefore) >= 0 ? dayBefore : firstLogged;

  const spanStartIdx = trendIndexOf(trend, spanStart);
  const spanEndIdx = trendIndexOf(trend, lastLogged);
  const spanPoints = trend.slice(spanStartIdx, spanEndIdx + 1);
  const slopePerDay = lsSlopePerDay(spanPoints);

  const avgIntake = sum / n;
  const raw = avgIntake - slopePerDay * KCAL_PER_KG;

  const w = n / (n + K);
  const blended = w * raw + (1 - w) * anchor;

  let result = blended;
  if (previous !== undefined && Number.isFinite(previous)) {
    const gap = daysSincePrevious !== undefined && Number.isFinite(daysSincePrevious) ? Math.max(0, daysSincePrevious) : 7;
    const maxDelta = (CAP_KCAL_PER_WEEK * gap) / 7;
    result = clamp(blended, previous - maxDelta, previous + maxDelta);
  }

  return { expenditure: Math.round(result), confidence: confidenceFor(n), daysUsed: n };
}

function mergeIntake(intake: { date: DateKey; kcal: number }[]): Map<DateKey, number> {
  const map = new Map<DateKey, number>();
  for (const e of intake) {
    // A single corrupt entry must never poison the series: skip non-finite / negative kcal.
    if (!Number.isFinite(e.kcal) || e.kcal < 0) continue;
    map.set(e.date, (map.get(e.date) ?? 0) + e.kcal);
  }
  return map;
}

export function estimateExpenditure(i: ExpenditureInput): ExpenditureResult {
  const windowDays = i.windowDays ?? 21;
  if (i.trend.length === 0) {
    const anchor = i.previous ?? i.prior;
    return { expenditure: Math.round(anchor), confidence: 'low', daysUsed: 0 };
  }
  const endDate = i.trend[i.trend.length - 1].date;
  const intakeMap = mergeIntake(i.intake);
  return computeWindow({
    intake: intakeMap,
    trend: i.trend,
    endDate,
    windowDays,
    prior: i.prior,
    previous: i.previous,
    daysSincePrevious: i.daysSincePrevious,
  });
}

/** Expenditure over time: one output point per trend point, using only data up to that date. */
export function expenditureSeries(
  intake: { date: DateKey; kcal: number }[],
  trend: DailyPoint[],
  prior: number,
  opts?: { windowDays?: number },
): DailyPoint[] {
  const windowDays = opts?.windowDays ?? 21;
  const intakeMap = mergeIntake(intake);
  const out: DailyPoint[] = new Array(trend.length);
  let previous: number | undefined;
  for (let k = 0; k < trend.length; k++) {
    const endDate = trend[k].date;
    const r = computeWindow({
      intake: intakeMap,
      trend,
      endDate,
      windowDays,
      prior,
      previous,
      daysSincePrevious: previous === undefined ? undefined : 1,
    });
    out[k] = { date: endDate, value: r.expenditure };
    previous = r.expenditure;
  }
  return out;
}
