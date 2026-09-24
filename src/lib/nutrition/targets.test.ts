import type { DietPreference, MacroTargets, Sex } from '@/db/types';
import { describe, expect, it } from 'vitest';
import { computeTargets, computeTargetsPerWeekday, PROTEIN_G_PER_KG, targetsFromProfile } from './targets';

const DIETS: DietPreference[] = ['balanced', 'low-fat', 'low-carb', 'keto', 'high-protein'];
const SEXES: Sex[] = ['male', 'female'];

function atwater(t: MacroTargets): number {
  return t.protein * 4 + t.carbs * 4 + t.fat * 9;
}

describe('computeTargets: calorie floor', () => {
  it('floors at 1500 for men', () => {
    const t = computeTargets({ tdee: 800, weightKg: 60, goalRatePctPerWeek: -1.5, diet: 'balanced', sex: 'male' });
    expect(t.kcal).toBe(1500);
  });

  it('floors at 1200 for women', () => {
    const t = computeTargets({ tdee: 800, weightKg: 50, goalRatePctPerWeek: -1.5, diet: 'balanced', sex: 'female' });
    expect(t.kcal).toBe(1200);
  });

  it('computes the deficit maths for a moderate goal rate', () => {
    // 2500 + (-0.5/100 * 80) * 7700 / 7 = 2500 + (-0.4 * 1100) = 2500 - 440 = 2060
    const t = computeTargets({ tdee: 2500, weightKg: 80, goalRatePctPerWeek: -0.5, diet: 'balanced', sex: 'male' });
    expect(t.kcal).toBe(2060);
  });
});

describe('computeTargets: macro invariants across a grid', () => {
  const weights = [40, 60, 80, 100, 150, 200];
  const tdees = [1200, 1800, 2500, 3200, 4500];
  const rates = [-1.5, -0.5, 0, 0.5, 1];

  for (const diet of DIETS) {
    it(`diet=${diet}: Atwater matches kcal within +/-15, grams are non-negative integers`, () => {
      for (const sex of SEXES) {
        for (const weightKg of weights) {
          for (const tdee of tdees) {
            for (const goalRatePctPerWeek of rates) {
              const t = computeTargets({ tdee, weightKg, goalRatePctPerWeek, diet, sex });

              expect(Number.isInteger(t.kcal)).toBe(true);
              expect(Number.isInteger(t.protein)).toBe(true);
              expect(Number.isInteger(t.carbs)).toBe(true);
              expect(Number.isInteger(t.fat)).toBe(true);
              expect(t.protein).toBeGreaterThanOrEqual(0);
              expect(t.carbs).toBeGreaterThanOrEqual(0);
              expect(t.fat).toBeGreaterThanOrEqual(0);

              expect(Math.abs(atwater(t) - t.kcal)).toBeLessThanOrEqual(15);

              if (diet === 'keto') {
                expect(t.carbs).toBeLessThanOrEqual(30);
              }
            }
          }
        }
      }
    });
  }

  it('matches the preset protein g/kg in the normal (non-overflow) case', () => {
    for (const diet of DIETS) {
      for (const sex of SEXES) {
        const t = computeTargets({ tdee: 2500, weightKg: 80, goalRatePctPerWeek: 0, diet, sex });
        expect(t.protein).toBe(Math.round(PROTEIN_G_PER_KG[diet] * 80));
      }
    }
  });

  it('keeps fat at or above the 0.6 g/kg floor when the budget allows it', () => {
    for (const diet of DIETS) {
      // A generous surplus at a large body weight leaves plenty of room for the fat floor.
      const t = computeTargets({ tdee: 3500, weightKg: 100, goalRatePctPerWeek: 0.5, diet, sex: 'male' });
      expect(t.fat).toBeGreaterThanOrEqual(Math.floor(0.6 * 100));
    }
  });

  it('handles the overflow case: 150kg female, high-protein, at the calorie floor', () => {
    const t = computeTargets({ tdee: 1400, weightKg: 150, goalRatePctPerWeek: -1.5, diet: 'high-protein', sex: 'female' });
    expect(t.kcal).toBe(1200);
    expect(t.carbs).toBe(0);
    expect(t.protein).toBeGreaterThanOrEqual(0);
    expect(t.fat).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(t.protein)).toBe(true);
    expect(Number.isInteger(t.fat)).toBe(true);
    expect(Math.abs(atwater(t) - t.kcal)).toBeLessThanOrEqual(15);
  });
});

describe('targetsFromProfile', () => {
  it('rounds tdee and derives targets consistently with computeTargets', () => {
    const profile = {
      sex: 'male' as const,
      birthDate: '1990-01-01',
      heightCm: 180,
      startWeightKg: 80,
      activity: 'moderate' as const,
      goal: 'lose' as const,
      goalRatePctPerWeek: -0.5,
      diet: 'balanced' as const,
      checkInWeekday: 0,
      onboardedAt: 0,
    };
    const result = targetsFromProfile(profile as any, 80, 30);
    expect(Number.isInteger(result.tdee)).toBe(true);
    expect(result.targets).toEqual(
      computeTargets({ tdee: result.tdee, weightKg: 80, goalRatePctPerWeek: -0.5, diet: 'balanced', sex: 'male' }),
    );
  });
});

describe('computeTargetsPerWeekday', () => {
  // Derived from computeTargets so it is internally Atwater-consistent, matching what
  // targetsFromProfile would actually hand to computeTargetsPerWeekday.
  const base: MacroTargets = computeTargets({
    tdee: 2500,
    weightKg: 80,
    goalRatePctPerWeek: -0.3,
    diet: 'balanced',
    sex: 'male',
  });

  it('throws on wrong-length weights', () => {
    expect(() => computeTargetsPerWeekday(base, [1, 1, 1, 1, 1, 1])).toThrow();
    expect(() => computeTargetsPerWeekday(base, [1, 1, 1, 1, 1, 1, 1, 1])).toThrow();
  });

  it('throws on non-positive or non-finite weights', () => {
    expect(() => computeTargetsPerWeekday(base, [1, 1, 1, 0, 1, 1, 1])).toThrow();
    expect(() => computeTargetsPerWeekday(base, [1, 1, 1, -1, 1, 1, 1])).toThrow();
    expect(() => computeTargetsPerWeekday(base, [1, 1, 1, NaN, 1, 1, 1])).toThrow();
    expect(() => computeTargetsPerWeekday(base, [1, 1, 1, Infinity, 1, 1, 1])).toThrow();
  });

  it('returns 7 days summing exactly to the weekly kcal total', () => {
    const days = computeTargetsPerWeekday(base, [1.2, 1, 1, 1, 1, 1, 1.2]);
    expect(days.length).toBe(7);
    const total = days.reduce((s, d) => s + d.kcal, 0);
    expect(total).toBe(base.kcal * 7);
  });

  it('keeps protein constant across days', () => {
    const days = computeTargetsPerWeekday(base, [1.2, 1, 1, 1, 1, 1, 1.2]);
    for (const d of days) {
      expect(d.protein).toBe(base.protein);
    }
  });

  it('keeps each day within +/-15 Atwater of its kcal', () => {
    const days = computeTargetsPerWeekday(base, [1.4, 0.8, 1, 1, 1, 1, 1.3]);
    for (const d of days) {
      expect(Math.abs(atwater(d) - d.kcal)).toBeLessThanOrEqual(15);
      expect(d.carbs).toBeGreaterThanOrEqual(0);
      expect(d.fat).toBeGreaterThanOrEqual(0);
    }
  });

  it('is proportional to the given weights (within +/-1 kcal)', () => {
    const weights = [1.5, 1, 1, 1, 1, 1, 1.5];
    const days = computeTargetsPerWeekday(base, weights);
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    const weeklyKcal = base.kcal * 7;
    days.forEach((d, i) => {
      const expected = (weeklyKcal * weights[i]) / totalWeight;
      expect(Math.abs(d.kcal - expected)).toBeLessThanOrEqual(1);
    });
  });

  it('returns 7 copies of base when weights are equal (modulo carb rounding)', () => {
    const days = computeTargetsPerWeekday(base, [1, 1, 1, 1, 1, 1, 1]);
    for (const d of days) {
      expect(d.kcal).toBe(base.kcal);
      expect(d.protein).toBe(base.protein);
      expect(d.fat).toBe(base.fat);
      expect(Math.abs(d.carbs - base.carbs)).toBeLessThanOrEqual(1);
    }
  });
});
