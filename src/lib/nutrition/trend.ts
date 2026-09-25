import type { DateKey } from '@/db/types';
import { addDays, daysBetween } from '@/lib/utils/date';
import type { DailyPoint } from './types';

/**
 * Groups raw weigh-ins by calendar date, averaging multiple entries on the same day.
 * Non-finite dates/values and non-positive kg are dropped. Returns dates sorted ascending.
 */
export function dailyAverages(weights: { date: DateKey; kg: number }[]): { date: DateKey; kg: number }[] {
  const byDay = new Map<DateKey, { sum: number; n: number }>();
  for (const w of weights) {
    if (!w || typeof w.date !== 'string' || !Number.isFinite(w.kg) || w.kg <= 0) continue;
    const entry = byDay.get(w.date);
    if (entry) {
      entry.sum += w.kg;
      entry.n += 1;
    } else {
      byDay.set(w.date, { sum: w.kg, n: 1 });
    }
  }
  const days = [...byDay.keys()].sort();
  return days.map((date) => {
    const { sum, n } = byDay.get(date)!;
    return { date, kg: sum / n };
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Neighbours further apart than this (in days) don't vouch for or against a reading. */
const OUTLIER_WINDOW_DAYS = 10;

/**
 * Keeps the underlying history intact while excluding implausible one-day averages from the trend.
 * A reading is dropped only when it is contradicted on BOTH sides: it needs nearby weigh-ins (within
 * 10 days) before and after it, at least three in total, and must sit more than max(3 kg, 3%) from
 * their median. The newest reading and the first reading after a break are therefore never dropped,
 * and sustained changes keep their support.
 */
export function excludeWeightOutliers(known: { date: DateKey; kg: number }[]): { date: DateKey; kg: number }[] {
  return known.filter((point, index) => {
    const near = (other: { date: DateKey }) => Math.abs(daysBetween(point.date, other.date)) <= OUTLIER_WINDOW_DAYS;
    const before = known.slice(Math.max(0, index - 3), index).filter(near);
    const after = known.slice(index + 1, index + 4).filter(near);
    if (before.length === 0 || after.length === 0 || before.length + after.length < 3) return true;
    const mid = median([...before, ...after].map((neighbour) => neighbour.kg));
    return Math.abs(point.kg - mid) <= Math.max(3, mid * 0.03);
  });
}

/**
 * Linearly interpolates a sparse, sorted series of known daily averages into one value per
 * calendar day from the first to the last date (inclusive). O(n + days): a moving index tracks
 * the next known day instead of re-scanning the array per day.
 */
export function interpolateDaily(known: { date: DateKey; kg: number }[]): { date: DateKey; kg: number }[] {
  if (known.length === 0) return [];
  const first = known[0].date;
  const last = known[known.length - 1].date;
  const out: { date: DateKey; kg: number }[] = [];
  let idx = 0; // index of the known point at or after the current day
  for (let d = first; d <= last; d = addDays(d, 1)) {
    while (idx < known.length - 1 && known[idx].date < d) idx++;
    if (known[idx].date === d) {
      out.push({ date: d, kg: known[idx].kg });
    } else {
      // d falls strictly between known[idx - 1] and known[idx]
      const prev = known[idx - 1];
      const next = known[idx];
      const span = daysBetween(prev.date, next.date);
      const t = daysBetween(prev.date, d) / span;
      out.push({ date: d, kg: prev.kg + (next.kg - prev.kg) * t });
    }
  }
  return out;
}

/**
 * Exponentially smoothed trend weight (default alpha = 0.1). Multiple weigh-ins on the same day
 * are averaged; implausible isolated daily averages are excluded; missing days are linearly
 * interpolated before smoothing. Robust to unsorted input and duplicate dates; ignores non-finite
 * or non-positive kg entries. Output has exactly one point per calendar day from the first to the
 * last retained weigh-in, sorted ascending. Empty input (or input with no valid entries) returns [].
 */
export function trendWeight(weights: { date: DateKey; kg: number }[], alpha = 0.1): DailyPoint[] {
  const known = excludeWeightOutliers(dailyAverages(weights));
  if (known.length === 0) return [];
  const daily = interpolateDaily(known);

  const out: DailyPoint[] = new Array(daily.length);
  let trend = daily[0].kg;
  out[0] = { date: daily[0].date, value: trend };
  for (let i = 1; i < daily.length; i++) {
    trend = trend + alpha * (daily[i].kg - trend);
    out[i] = { date: daily[i].date, value: trend };
  }
  return out;
}

/**
 * Ordinary least-squares slope (value per day) of a series of points against day offsets from
 * the first point, computed via `daysBetween` (so it is correct even for gappy series). Returns 0
 * when there are fewer than 2 points or zero x-variance.
 */
export function lsSlopePerDay(points: DailyPoint[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const base = points[0].date;
  const xs = points.map((p) => daysBetween(base, p.date));
  const ys = points.map((p) => p.value);
  const xbar = xs.reduce((s, v) => s + v, 0) / n;
  const ybar = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xbar;
    num += dx * (ys[i] - ybar);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * kg/week change of the trend, computed as the OLS slope of trend value vs. day offset over the
 * last `days` + 1 points (or all points if fewer), times 7. Negative = losing. Returns 0 when
 * there are fewer than 2 points or zero x-variance in the window.
 */
export function weeklyRate(trend: DailyPoint[], days = 14): number {
  if (trend.length < 2) return 0;
  const window = trend.slice(Math.max(0, trend.length - (days + 1)));
  return lsSlopePerDay(window) * 7;
}
