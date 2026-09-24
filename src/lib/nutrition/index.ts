/**
 * Public API of the nutrition engine (contract). UI code imports ONLY from '@/lib/nutrition'.
 * Wave 0 ships baseline implementations of the onboarding functions; Wave 1 (W1) owns this
 * folder, splits it into bmr.ts / trend.ts / expenditure.ts / targets.ts / projection.ts,
 * adds tests, and keeps these exported signatures stable.
 */
import type { ActivityLevel, DateKey, DietPreference, MacroTargets, Profile, Sex } from '@/db/types';

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

/** Mifflin-St Jeor; Katch-McArdle when body fat is known. */
export function bmr(b: BodyInput): number {
  if (b.bodyFatPct !== undefined && b.bodyFatPct > 0) {
    const lbm = b.weightKg * (1 - b.bodyFatPct / 100);
    return 370 + 21.6 * lbm;
  }
  const base = 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.age;
  return b.sex === 'male' ? base + 5 : base - 161;
}

export function initialTdee(b: BodyInput, activity: ActivityLevel): number {
  return bmr(b) * ACTIVITY_MULTIPLIER[activity];
}

export interface TargetInput {
  tdee: number;
  weightKg: number;
  /** signed %BW per week, e.g. -0.5 */
  goalRatePctPerWeek: number;
  diet: DietPreference;
  sex: Sex;
}

/** Calorie + macro targets from expenditure and goal. */
export function computeTargets(t: TargetInput): MacroTargets {
  const kgPerWeek = (t.goalRatePctPerWeek / 100) * t.weightKg;
  const floor = t.sex === 'male' ? 1500 : 1200;
  const kcal = Math.max(floor, Math.round(t.tdee + (kgPerWeek * KCAL_PER_KG) / 7));

  const proteinPerKg: Record<DietPreference, number> = {
    balanced: 1.8, 'low-fat': 1.8, 'low-carb': 2.0, keto: 1.8, 'high-protein': 2.2,
  };
  const fatShare: Record<DietPreference, number> = {
    balanced: 0.3, 'low-fat': 0.2, 'low-carb': 0.45, keto: 0.7, 'high-protein': 0.28,
  };
  const protein = Math.round(proteinPerKg[t.diet] * t.weightKg);
  let fat = Math.round((kcal * fatShare[t.diet]) / 9);
  fat = Math.max(fat, Math.round(0.6 * t.weightKg));
  let carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
  if (t.diet === 'keto') carbs = Math.min(carbs, 30);
  carbs = Math.max(0, carbs);
  // keep kcal consistent with macros after clamping
  if (t.diet === 'keto') fat = Math.max(fat, Math.round((kcal - protein * 4 - carbs * 4) / 9));
  return { kcal, protein, carbs, fat };
}

export function targetsFromProfile(p: Profile, weightKg: number, age: number): { tdee: number; targets: MacroTargets } {
  const tdee = Math.round(initialTdee({ sex: p.sex, age, heightCm: p.heightCm, weightKg, bodyFatPct: p.bodyFatPct }, p.activity));
  return { tdee, targets: computeTargets({ tdee, weightKg, goalRatePctPerWeek: p.goalRatePctPerWeek, diet: p.diet, sex: p.sex }) };
}

// ---- Contract for Wave 1 (W1 implements; signatures are fixed) ----

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
  /** previous estimate for smoothing (defaults to prior) */
  previous?: number;
  windowDays?: number;
}
export interface ExpenditureResult { expenditure: number; confidence: 'low' | 'medium' | 'high'; daysUsed: number }
export type EstimateExpenditureFn = (i: ExpenditureInput) => ExpenditureResult;

export { trendWeight, weeklyRate } from './trend';
export { estimateExpenditure, expenditureSeries } from './expenditure';
export { projectGoalDate } from './projection';
