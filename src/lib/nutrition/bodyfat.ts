/**
 * Body fat estimates for people without a scan: US Navy tape method, Relative Fat Mass (RFM) and a
 * visual guide. All lengths in cm. Results outside 3–60 % are treated as measurement errors.
 */
import type { Sex } from '@/db/types';

const MIN_PCT = 3;
const MAX_PCT = 60;

const plausible = (v: number | undefined, lo: number, hi: number): v is number => v !== undefined && Number.isFinite(v) && v >= lo && v <= hi;
const inRange = (pct: number) => (Number.isFinite(pct) && pct >= MIN_PCT && pct <= MAX_PCT ? pct : null);

export interface NavyInput {
  sex: Sex;
  heightCm: number;
  neckCm?: number;
  waistCm?: number;
  /** required for women */
  hipCm?: number;
}

/** US Navy circumference method (Hodgdon & Beckett), metric form. Typical error ±3–4 %. */
export function navyBodyFat({ sex, heightCm, neckCm, waistCm, hipCm }: NavyInput): number | null {
  if (!plausible(heightCm, 120, 230) || !plausible(neckCm, 20, 70) || !plausible(waistCm, 45, 200)) return null;
  if (sex === 'male') {
    if (waistCm <= neckCm) return null;
    return inRange(495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450);
  }
  if (!plausible(hipCm, 60, 200) || waistCm + hipCm <= neckCm) return null;
  return inRange(495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450);
}

/** Relative Fat Mass (Woolcott & Bergman 2018): height and waist only. Typical error ±5 %. */
export function rfmBodyFat({ sex, heightCm, waistCm }: { sex: Sex; heightCm: number; waistCm?: number }): number | null {
  if (!plausible(heightCm, 120, 230) || !plausible(waistCm, 45, 200)) return null;
  return inRange((sex === 'male' ? 64 : 76) - (20 * heightCm) / waistCm);
}

export interface BodyTypeBand {
  min: number;
  max: number;
  midpoint: number;
  label: string;
  description: string;
}

export const BODY_TYPE_GUIDE: Record<Sex, BodyTypeBand[]> = {
  male: [
    { min: 6, max: 9, midpoint: 8, label: 'Very lean', description: 'Sharp abs and visible veins; typical for physique competitors.' },
    { min: 10, max: 14, midpoint: 12, label: 'Lean', description: 'Abs visible when relaxed, clear muscle separation.' },
    { min: 15, max: 19, midpoint: 17, label: 'Fit', description: 'Outline of abs, a little softness around the waist.' },
    { min: 20, max: 24, midpoint: 22, label: 'Average', description: 'No visible abs, some fat on the belly and love handles.' },
    { min: 25, max: 29, midpoint: 27, label: 'Above average', description: 'Rounder belly, waist wider than the chest when relaxed.' },
    { min: 30, max: 40, midpoint: 33, label: 'High', description: 'Belly clearly protrudes; fat on arms, back and face.' },
  ],
  female: [
    { min: 14, max: 17, midpoint: 16, label: 'Very lean', description: 'Visible abs and muscle definition; typical for athletes.' },
    { min: 18, max: 22, midpoint: 20, label: 'Lean', description: 'Toned stomach, slight ab outline, defined arms and legs.' },
    { min: 23, max: 27, midpoint: 25, label: 'Fit', description: 'Flat-ish stomach, soft curves, little definition.' },
    { min: 28, max: 32, midpoint: 30, label: 'Average', description: 'Softer stomach, fat on hips and thighs.' },
    { min: 33, max: 37, midpoint: 35, label: 'Above average', description: 'Rounder stomach, more fat on hips, thighs and arms.' },
    { min: 38, max: 50, midpoint: 42, label: 'High', description: 'Stomach and hips clearly carry fat; face and arms fuller.' },
  ],
};

/** Band label for a percentage, e.g. "Fit". Values between bands round to the nearest band. */
export function bodyFatCategory(sex: Sex, pct: number): string {
  const bands = BODY_TYPE_GUIDE[sex];
  const hit = bands.find((b) => pct >= b.min && pct < b.max + 1);
  if (hit) return hit.label;
  return pct < bands[0].min ? bands[0].label : bands[bands.length - 1].label;
}

export function leanAndFatMass(kg: number, pct: number): { leanKg: number; fatKg: number } {
  const fatKg = (kg * pct) / 100;
  return { leanKg: kg - fatKg, fatKg };
}
