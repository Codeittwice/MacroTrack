import { describe, expect, it } from 'vitest';
import { bmr, initialTdee, katchMcArdle, mifflinStJeor } from './bmr';
import { ACTIVITY_MULTIPLIER } from './types';

describe('bmr', () => {
  it('matches the published Mifflin-St Jeor example for men', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(bmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 })).toBeCloseTo(1780, 5);
    expect(mifflinStJeor({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 })).toBeCloseTo(1780, 5);
  });

  it('matches the Mifflin-St Jeor formula for women', () => {
    // 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
    const value = bmr({ sex: 'female', age: 25, heightCm: 165, weightKg: 60 });
    expect(Math.round(value)).toBe(1345);
    expect(value).toBeCloseTo(1345.25, 2);
  });

  it('uses Katch-McArdle when body fat % is known', () => {
    // 370 + 21.6 * (80 * 0.8) = 370 + 21.6*64 = 370 + 1382.4 = 1752.4
    const value = bmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, bodyFatPct: 20 });
    expect(value).toBeCloseTo(1752.4, 5);
    expect(katchMcArdle(80, 20)).toBeCloseTo(1752.4, 5);
  });

  it('falls back to Mifflin-St Jeor when bodyFatPct is out of range', () => {
    const noBf = bmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 });
    expect(bmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, bodyFatPct: 0 })).toBeCloseTo(noBf, 5);
    expect(bmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, bodyFatPct: 100 })).toBeCloseTo(noBf, 5);
    expect(bmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, bodyFatPct: -5 })).toBeCloseTo(noBf, 5);
  });
});

describe('initialTdee', () => {
  it('multiplies BMR by the activity multiplier', () => {
    const b = { sex: 'male' as const, age: 30, heightCm: 180, weightKg: 80 };
    for (const activity of Object.keys(ACTIVITY_MULTIPLIER) as (keyof typeof ACTIVITY_MULTIPLIER)[]) {
      expect(initialTdee(b, activity)).toBeCloseTo(bmr(b) * ACTIVITY_MULTIPLIER[activity], 5);
    }
  });
});
