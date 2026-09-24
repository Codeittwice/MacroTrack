import type { Nutrients } from '@/db/types';

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

const KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'satFat', 'sodium', 'salt', 'alcohol'] as const;

/** Scale per-100 values to an amount in grams. */
export function scale(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  const out: Nutrients = { ...ZERO };
  for (const k of KEYS) {
    const v = per100[k];
    if (v !== undefined) out[k] = v * f;
  }
  return out;
}

export function sum(list: Nutrients[]): Nutrients {
  const out: Nutrients = { ...ZERO };
  for (const n of list) {
    for (const k of KEYS) {
      const v = n[k];
      if (v !== undefined) out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

/** Atwater kcal from macros (for sanity checks / quick add). */
export const atwater = (p: number, c: number, f: number, alcohol = 0) => p * 4 + c * 4 + f * 9 + alcohol * 7;

export const round = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
