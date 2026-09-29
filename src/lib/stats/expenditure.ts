/**
 * Adaptive expenditure estimate wired to a Profile + raw weigh-ins + daily intake.
 */
import type { DateKey, Profile, WeightEntry } from '@/db/types';
import { estimateExpenditure, targetsFromProfile, trendWeight, type ExpenditureResult } from '@/lib/nutrition';
import { ageOn, daysBetween, today as todayFn } from '@/lib/utils/date';

export interface CurrentExpenditureArgs {
  profile: Profile;
  /** raw weigh-ins (any order; sorted by date internally) */
  weights: WeightEntry[];
  /** daily intake totals, e.g. from getDailyIntake over the last 60 days */
  intake: { date: DateKey; kcal: number }[];
  /** latest TargetSet.tdee: the estimate is smoothed toward it (same semantics as the coach) */
  previous?: number;
  /** effectiveFrom of that TargetSet; the allowed change grows with the days since then */
  previousDate?: DateKey;
  /** defaults to today(); used for age */
  today?: DateKey;
}

/** Latest (by date) valid raw weigh-in, or undefined. */
function latestRawWeightKg(weights: WeightEntry[]): number | undefined {
  let best: WeightEntry | undefined;
  for (const w of weights) {
    if (!w || typeof w.date !== 'string' || !Number.isFinite(w.kg) || w.kg <= 0) continue;
    if (!best || w.date > best.date) best = w;
  }
  return best?.kg;
}

/**
 * Adaptive expenditure estimate.
 * prior = previous (if finite > 0) ?? targetsFromProfile(profile, weightKg, ageOn(profile.birthDate, today)).tdee,
 * where weightKg = latest trend weight ?? latest raw weight ?? profile.startWeightKg.
 * trend = trendWeight(weights).
 * Returns estimateExpenditure({ intake, trend, prior }).
 * With no weights (empty trend) returns { expenditure: Math.round(prior), confidence: 'low', daysUsed: 0 }
 * without calling the estimator.
 */
export function currentExpenditure(args: CurrentExpenditureArgs): ExpenditureResult {
  const { profile, weights, intake } = args;
  const today = args.today ?? todayFn();

  const trend = trendWeight(weights.map((w) => ({ date: w.date, kg: w.kg })));
  const trendWeightKg = trend.length > 0 ? trend[trend.length - 1].value : undefined;
  const weightKg = trendWeightKg ?? latestRawWeightKg(weights) ?? profile.startWeightKg;

  const prior = targetsFromProfile(profile, weightKg, ageOn(profile.birthDate, today)).tdee;
  const previous = args.previous !== undefined && Number.isFinite(args.previous) && args.previous > 0 ? args.previous : undefined;

  if (trend.length === 0) {
    return { expenditure: Math.round(previous ?? prior), confidence: 'low', daysUsed: 0 };
  }

  const daysSincePrevious = previous !== undefined && args.previousDate ? Math.max(0, daysBetween(args.previousDate, today)) : undefined;
  return estimateExpenditure({ intake, trend, prior, previous, daysSincePrevious });
}
