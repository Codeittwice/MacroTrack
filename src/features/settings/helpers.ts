/**
 * Pure helpers for the Settings page. Kept dependency-free (no db/react) so they're easy to unit test.
 */
import type { GoalType } from '@/db/types';

export function atwaterKcal(protein: number, carbs: number, fat: number): number {
  return 4 * protein + 4 * carbs + 9 * fat;
}

/** True when the Atwater-derived kcal differs from the entered kcal by more than 5%. */
export function kcalMismatch(enteredKcal: number, atwater: number): boolean {
  if (!Number.isFinite(enteredKcal) || enteredKcal <= 0) return false;
  return Math.abs(atwater - enteredKcal) / enteredKcal > 0.05;
}

export function isFiniteNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export const validateHeightCm = (v: number) => isFiniteNum(v) && v >= 120 && v <= 230;
export const validateWeightKg = (v: number) => isFiniteNum(v) && v >= 30 && v <= 300;
export const validateAge = (v: number) => isFiniteNum(v) && v >= 14 && v <= 100;
export const validateBodyFatPct = (v: number) => isFiniteNum(v) && v >= 3 && v <= 60;
export const validateWaterGoalMl = (v: number) => isFiniteNum(v) && v >= 250 && v <= 10_000;

/** Combine an unsigned %BW/week magnitude with the goal direction into the signed value stored on Profile. */
export function signedRate(goal: GoalType, magnitude: number): number {
  const m = Math.abs(magnitude);
  if (goal === 'lose') return -m;
  if (goal === 'gain') return m;
  return 0;
}

// --- Meal list ops -------------------------------------------------------

export function renameMeal(names: string[], idx: number, name: string): string[] {
  return names.map((n, i) => (i === idx ? name : n));
}

export function addMeal(names: string[], name = 'New meal'): string[] {
  return [...names, name];
}

export function removeMeal(names: string[], idx: number): string[] {
  if (names.length <= 1) return names;
  return names.filter((_, i) => i !== idx);
}

export function moveMeal(names: string[], idx: number, dir: -1 | 1): string[] {
  const j = idx + dir;
  if (j < 0 || j >= names.length) return names;
  const next = [...names];
  const tmp = next[idx];
  next[idx] = next[j];
  next[j] = tmp;
  return next;
}

/** Trims every name; returns null (reject) if any name is empty after trimming. */
export function sanitizeMealNames(names: string[]): string[] | null {
  const trimmed = names.map((n) => n.trim());
  if (trimmed.some((n) => n.length === 0)) return null;
  return trimmed;
}
