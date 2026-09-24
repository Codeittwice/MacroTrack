/**
 * Weekly check-in proposal: recomputes expenditure and macro targets from the latest weight and
 * intake logs, anchored to the previous expenditure estimate for smoothing continuity.
 */
import type { DateKey, MacroTargets, Profile } from '@/db/types';
import { initialTdee } from './bmr';
import { computeTargets } from './targets';
import { estimateExpenditure } from './expenditure';
import { trendWeight, weeklyRate } from './trend';
import { daysBetween } from '@/lib/utils/date';

/** Weigh-ins older than this (relative to the check-in date) downgrade confidence to 'low'. */
const STALE_AFTER_DAYS = 7;

export interface ProposeCheckInArgs {
  profile: Profile;
  weights: { date: DateKey; kg: number }[];
  intake: { date: DateKey; kcal: number }[];
  previousExpenditure?: number;
  currentWeightKg: number;
  age: number;
  date: DateKey;
}

export interface ProposeCheckInResult {
  expenditure: number;
  trendWeightKg: number;
  weeklyRateKg: number;
  proposed: MacroTargets;
  confidence: 'low' | 'medium' | 'high';
  /** Days between the last weigh-in and the check-in date (0 = weighed today). */
  staleDays: number;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function proposeCheckIn(args: ProposeCheckInArgs): ProposeCheckInResult {
  const { profile, previousExpenditure, currentWeightKg, age, date } = args;

  const weights = args.weights.filter((w) => w.date <= date);
  const intake = args.intake.filter((e) => e.date <= date);

  const trend = trendWeight(weights);
  const trendWeightKg = trend.length > 0 ? trend[trend.length - 1].value : currentWeightKg;
  const prior = Math.round(
    initialTdee(
      { sex: profile.sex, age, heightCm: profile.heightCm, weightKg: trendWeightKg, bodyFatPct: profile.bodyFatPct },
      profile.activity,
    ),
  );

  const est = estimateExpenditure({
    intake,
    trend,
    prior,
    previous: previousExpenditure,
  });

  const expenditure = est.expenditure;
  const staleDays = trend.length > 0 ? Math.max(0, daysBetween(trend[trend.length - 1].date, date)) : Infinity;
  const confidence = staleDays > STALE_AFTER_DAYS ? 'low' : est.confidence;
  const weeklyRateKg = weeklyRate(trend);

  const proposed = computeTargets({
    tdee: expenditure,
    weightKg: trendWeightKg,
    goalRatePctPerWeek: profile.goalRatePctPerWeek,
    diet: profile.diet,
    sex: profile.sex,
  });

  return {
    expenditure: Math.round(expenditure),
    trendWeightKg: round2(trendWeightKg),
    weeklyRateKg: round2(weeklyRateKg),
    proposed: {
      kcal: Math.round(proposed.kcal),
      protein: Math.round(proposed.protein),
      carbs: Math.round(proposed.carbs),
      fat: Math.round(proposed.fat),
    },
    confidence,
    staleDays: Number.isFinite(staleDays) ? staleDays : -1,
  };
}
