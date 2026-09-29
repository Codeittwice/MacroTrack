/**
 * Calorie + macro target computation, and per-weekday calorie cycling.
 */
import type { DietPreference, MacroTargets, Profile } from '@/db/types';
import { initialTdee } from './bmr';
import { KCAL_PER_KG, type TargetInput } from './types';

/** Protein target, in grams per kg body weight, by diet preset. */
export const PROTEIN_G_PER_KG: Record<DietPreference, number> = {
  balanced: 1.8,
  'low-fat': 1.8,
  'low-carb': 2.0,
  keto: 1.8,
  'high-protein': 2.2,
};

/** Share of total kcal that comes from fat, by diet preset (before the fat floor / keto carb cap adjust it). */
const FAT_SHARE: Record<DietPreference, number> = {
  balanced: 0.3,
  'low-fat': 0.2,
  'low-carb': 0.45,
  keto: 0.7,
  'high-protein': 0.28,
};

/** Minimum fat intake, in grams per kg body weight. */
const FAT_FLOOR_G_PER_KG = 0.6;

/** Keto caps carbs at this many grams/day; the rest of the budget goes to fat. */
const KETO_CARB_CAP_G = 30;

interface Allocation {
  protein: number;
  fat: number;
  carbs: number;
}

/**
 * Allocate (unrounded) grams for a kcal budget, respecting the priority
 * kcal (fixed) > fat floor > protein > carbs.
 * When the budget can't fit every target, carbs are cut to 0 first, then protein,
 * and only then is fat trimmed below its floor/share target.
 */
function allocateMacros(kcal: number, proteinTarget: number, fatTarget: number, carbCap: number): Allocation {
  let protein = proteinTarget;
  let fat = fatTarget;
  let carbs: number;

  const remainderForCarbs = kcal - protein * 4 - fat * 9;
  if (remainderForCarbs >= 0) {
    carbs = Math.min(carbCap, remainderForCarbs / 4);
    // Anything the carb cap doesn't use (keto) is absorbed by fat.
    const leftoverKcal = remainderForCarbs - carbs * 4;
    fat = fat + leftoverKcal / 9;
  } else {
    carbs = 0;
    const remainingForProtein = kcal - fat * 9;
    if (remainingForProtein >= 0) {
      protein = Math.min(protein, remainingForProtein / 4);
    } else {
      protein = 0;
    }
    const remainingForFat = kcal - protein * 4;
    if (fat * 9 > remainingForFat) {
      fat = Math.max(0, remainingForFat / 9);
    }
  }
  return { protein, fat, carbs };
}

/** Round grams to integers, choosing rounding order to minimize the Atwater residual. */
function finalizeRounding(kcal: number, a: Allocation, isKeto: boolean): MacroTargets {
  const proteinR = Math.max(0, Math.round(a.protein));
  if (isKeto) {
    // protein + carbs are rounded first; fat absorbs whatever's left.
    const carbsR = Math.max(0, Math.min(KETO_CARB_CAP_G, Math.round(a.carbs)));
    const fatR = Math.max(0, Math.round((kcal - proteinR * 4 - carbsR * 4) / 9));
    return { kcal, protein: proteinR, carbs: carbsR, fat: fatR };
  }
  // protein + fat are rounded first; carbs fill the remainder.
  const fatR = Math.max(0, Math.round(a.fat));
  const carbsR = Math.max(0, Math.round((kcal - proteinR * 4 - fatR * 9) / 4));
  return { kcal, protein: proteinR, carbs: carbsR, fat: fatR };
}

/** Calorie + macro targets from expenditure and goal rate. */
export function computeTargets(t: TargetInput): MacroTargets {
  const kgPerWeek = (t.goalRatePctPerWeek / 100) * t.weightKg;
  const floor = t.sex === 'male' ? 1500 : 1200;
  const kcal = Math.max(floor, Math.round(t.tdee + (kgPerWeek * KCAL_PER_KG) / 7));

  const isKeto = t.diet === 'keto';
  const proteinTarget = PROTEIN_G_PER_KG[t.diet] * t.weightKg;
  const fatFloor = FAT_FLOOR_G_PER_KG * t.weightKg;
  const fatTarget = Math.max((kcal * FAT_SHARE[t.diet]) / 9, fatFloor);
  const carbCap = isKeto ? KETO_CARB_CAP_G : Infinity;

  const allocation = allocateMacros(kcal, proteinTarget, fatTarget, carbCap);
  return finalizeRounding(kcal, allocation, isKeto);
}

export function targetsFromProfile(
  p: Profile,
  weightKg: number,
  age: number,
): { tdee: number; targets: MacroTargets } {
  const tdee = Math.round(
    initialTdee({ sex: p.sex, age, heightCm: p.heightCm, weightKg, bodyFatPct: p.bodyFatPct }, p.activity),
  );
  return {
    tdee,
    targets: computeTargets({ tdee, weightKg, goalRatePctPerWeek: p.goalRatePctPerWeek, diet: p.diet, sex: p.sex }),
  };
}

/**
 * Split a base daily target into 7 weekday targets (index 0 = Sunday, matching
 * TargetSet.perWeekday) for calorie cycling. `weights` are positive relative weights;
 * the weekly kcal total (7 * base.kcal) is redistributed proportionally to them, with
 * per-day kcal rounded via largest-remainder so the week sums exactly. Protein is held
 * constant; fat stays at base.fat and carbs flex to hit each day's kcal, unless that
 * would push carbs below 0, in which case fat is lowered instead.
 */
export function computeTargetsPerWeekday(base: MacroTargets, weights: number[]): MacroTargets[] {
  if (weights.length !== 7) {
    throw new Error('computeTargetsPerWeekday: weights must have length 7');
  }
  for (const w of weights) {
    if (!Number.isFinite(w) || w <= 0) {
      throw new Error('computeTargetsPerWeekday: weights must be positive finite numbers');
    }
  }

  const weeklyKcal = base.kcal * 7;
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const rawShares = weights.map((w) => (weeklyKcal * w) / totalWeight);
  const floors = rawShares.map((x) => Math.floor(x));
  const flooredTotal = floors.reduce((sum, x) => sum + x, 0);
  const remainder = weeklyKcal - flooredTotal;

  const byFracDesc = rawShares
    .map((x, i) => ({ i, frac: x - floors[i] }))
    .sort((a, b) => b.frac - a.frac);

  const dayKcal = [...floors];
  for (let k = 0; k < remainder; k++) {
    dayKcal[byFracDesc[k].i] += 1;
  }

  return dayKcal.map((kcal) => {
    const protein = base.protein;
    let fat = base.fat;
    let carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
    if (carbs < 0) {
      carbs = 0;
      fat = Math.max(0, Math.round((kcal - protein * 4) / 9));
    }
    return { kcal, protein, carbs, fat };
  });
}
