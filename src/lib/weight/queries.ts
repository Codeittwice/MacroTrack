/**
 * Weight read API (contract, Wave 2). W4 owns lib/weight and adds mutations in lib/weight/actions.ts.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { alive } from '@/db/repo';
import type { WeightEntry } from '@/db/types';
import { trendWeight, weeklyRate, type DailyPoint } from '@/lib/nutrition';

export async function getWeights(): Promise<WeightEntry[]> {
  return (await db.weights.orderBy('date').toArray()).filter(alive);
}

export function useWeights(): WeightEntry[] | undefined {
  return useLiveQuery(getWeights, []);
}

export interface TrendSummary {
  trend: DailyPoint[];
  latestTrendKg?: number;
  latestRawKg?: number;
  /** kg/week over the last 14 days (negative = losing) */
  weeklyRateKg: number;
}

export function summarizeTrend(weights: WeightEntry[]): TrendSummary {
  const trend = trendWeight(weights.map((w) => ({ date: w.date, kg: w.kg })));
  return {
    trend,
    latestTrendKg: trend.at(-1)?.value,
    latestRawKg: weights.at(-1)?.kg,
    weeklyRateKg: weeklyRate(trend),
  };
}

export function useTrend(): TrendSummary | undefined {
  const weights = useWeights();
  return weights ? summarizeTrend(weights) : undefined;
}
