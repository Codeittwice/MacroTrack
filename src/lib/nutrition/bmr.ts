/**
 * Basal metabolic rate + initial TDEE estimation.
 * Mifflin-St Jeor when body-fat % is unknown, Katch-McArdle when it is known.
 */
import type { ActivityLevel } from '@/db/types';
import { ACTIVITY_MULTIPLIER, type BodyInput } from './types';

/** Mifflin-St Jeor equation (kcal/day). */
export function mifflinStJeor(b: BodyInput): number {
  const base = 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.age;
  return b.sex === 'male' ? base + 5 : base - 161;
}

/** Katch-McArdle equation from lean body mass (kcal/day). */
export function katchMcArdle(weightKg: number, bodyFatPct: number): number {
  const lbm = weightKg * (1 - bodyFatPct / 100);
  return 370 + 21.6 * lbm;
}

/**
 * Basal metabolic rate. Uses Katch-McArdle when a valid body-fat % (0 < bf < 100) is known,
 * otherwise falls back to Mifflin-St Jeor.
 */
export function bmr(b: BodyInput): number {
  if (b.bodyFatPct !== undefined && b.bodyFatPct > 0 && b.bodyFatPct < 100) {
    return katchMcArdle(b.weightKg, b.bodyFatPct);
  }
  return mifflinStJeor(b);
}

/** Total daily energy expenditure estimate from BMR and activity level. */
export function initialTdee(b: BodyInput, activity: ActivityLevel): number {
  return bmr(b) * ACTIVITY_MULTIPLIER[activity];
}
