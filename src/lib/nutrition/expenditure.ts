import type { DateKey } from '@/db/types';
import { addDays } from '@/lib/utils/date';
import { KCAL_PER_KG, type DailyPoint, type ExpenditureInput, type ExpenditureResult } from './index';

/** Baseline (Wave 0). W1 hardens + tests (simulated data must recover TDEE within ±75 kcal). */
export function estimateExpenditure(i: ExpenditureInput): ExpenditureResult {
  const windowDays = i.windowDays ?? 21;
  const prev = i.previous ?? i.prior;
  if (i.trend.length === 0) return { expenditure: Math.round(prev), confidence: 'low', daysUsed: 0 };
  const endDate = i.trend[i.trend.length - 1].date;
  const startDate = addDays(endDate, -windowDays);
  const trendMap = new Map(i.trend.map((p) => [p.date, p.value]));
  const logged = i.intake.filter((d) => d.date > startDate && d.date <= endDate && trendMap.has(d.date));
  if (logged.length < 10) return { expenditure: Math.round(prev), confidence: 'low', daysUsed: logged.length };

  const firstDate = logged[0].date;
  const t0 = trendMap.get(addDays(firstDate, -1)) ?? trendMap.get(firstDate)!;
  const t1 = trendMap.get(endDate)!;
  const days = logged.length;
  const avgIntake = logged.reduce((s, d) => s + d.kcal, 0) / days;
  const spanDays = Math.max(1, i.trend.findIndex((p) => p.date === endDate) - i.trend.findIndex((p) => p.date === firstDate) + 1);
  const raw = avgIntake - ((t1 - t0) * KCAL_PER_KG) / spanDays;

  // smooth toward previous, capped change
  const blended = prev + 0.5 * (raw - prev);
  const capped = Math.max(prev - 150, Math.min(prev + 150, blended));
  return { expenditure: Math.round(capped), confidence: days >= 18 ? 'high' : 'medium', daysUsed: days };
}

/** Expenditure over time (one point per day where enough data). */
export function expenditureSeries(
  intake: { date: DateKey; kcal: number }[],
  trend: DailyPoint[],
  prior: number,
): DailyPoint[] {
  const out: DailyPoint[] = [];
  let prev = prior;
  for (let k = 0; k < trend.length; k++) {
    const r = estimateExpenditure({ intake, trend: trend.slice(0, k + 1), prior, previous: prev });
    prev = r.expenditure;
    out.push({ date: trend[k].date, value: r.expenditure });
  }
  return out;
}
