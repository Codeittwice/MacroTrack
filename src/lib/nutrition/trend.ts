import type { DateKey } from '@/db/types';
import { addDays, daysBetween } from '@/lib/utils/date';
import type { DailyPoint } from './index';

/** Baseline (Wave 0). W1 hardens + tests. */
export function trendWeight(weights: { date: DateKey; kg: number }[], alpha = 0.1): DailyPoint[] {
  if (weights.length === 0) return [];
  const byDay = new Map<DateKey, number[]>();
  for (const w of weights) {
    const arr = byDay.get(w.date) ?? [];
    arr.push(w.kg);
    byDay.set(w.date, arr);
  }
  const days = [...byDay.keys()].sort();
  const avg = (d: DateKey) => {
    const a = byDay.get(d)!;
    return a.reduce((s, v) => s + v, 0) / a.length;
  };
  const first = days[0];
  const last = days[days.length - 1];
  const out: DailyPoint[] = [];
  let trend = avg(first);
  let prevKnown = { date: first, kg: trend };
  let nextIdx = 1;
  for (let d = first; d <= last; d = addDays(d, 1)) {
    let raw: number;
    if (byDay.has(d)) {
      raw = avg(d);
      prevKnown = { date: d, kg: raw };
      nextIdx = days.indexOf(d) + 1;
    } else {
      const next = days[nextIdx];
      const span = daysBetween(prevKnown.date, next);
      const t = daysBetween(prevKnown.date, d) / span;
      raw = prevKnown.kg + (avg(next) - prevKnown.kg) * t;
    }
    trend = d === first ? raw : trend + alpha * (raw - trend);
    out.push({ date: d, value: trend });
  }
  return out;
}

/** kg/week change of the trend over the last `days` days (negative = losing). */
export function weeklyRate(trend: DailyPoint[], days = 14): number {
  if (trend.length < 2) return 0;
  const end = trend[trend.length - 1];
  const start = trend[Math.max(0, trend.length - 1 - days)];
  const span = daysBetween(start.date, end.date);
  return span > 0 ? ((end.value - start.value) / span) * 7 : 0;
}
