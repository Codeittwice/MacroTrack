/**
 * Shared constants + contract types for the nutrition engine.
 * Implementation modules import from here (NOT from './index') to avoid import cycles.
 * index.ts re-exports everything in this file.
 */
import type { ActivityLevel, DateKey, DietPreference, Sex } from '@/db/types';

/** Energy density of body-mass change (kcal per kg). */
export const KCAL_PER_KG = 7700;

export const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

export interface BodyInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number;
}

export interface TargetInput {
  tdee: number;
  weightKg: number;
  /** signed %BW per week, e.g. -0.5 */
  goalRatePctPerWeek: number;
  diet: DietPreference;
  sex: Sex;
}

export interface DailyPoint { date: DateKey; value: number }

/**
 * Exponentially smoothed trend weight (alpha ~0.1). Input: raw weights (multiple per day averaged,
 * missing days interpolated). Output: one point per day from first to last weigh-in.
 */
export type TrendWeightFn = (weights: { date: DateKey; kg: number }[], alpha?: number) => DailyPoint[];

export interface ExpenditureInput {
  /** daily logged kcal; days missing or flagged incomplete are omitted */
  intake: { date: DateKey; kcal: number }[];
  trend: DailyPoint[];
  /** formula TDEE fallback / prior */
  prior: number;
  /** previous estimate for smoothing (when omitted: no change cap is applied, anchor = prior) */
  previous?: number;
  windowDays?: number;
  /** days elapsed since `previous` was computed; scales the ±100 kcal / 7 d change cap (default 7) */
  daysSincePrevious?: number;
}
export interface ExpenditureResult { expenditure: number; confidence: 'low' | 'medium' | 'high'; daysUsed: number }
export type EstimateExpenditureFn = (i: ExpenditureInput) => ExpenditureResult;
