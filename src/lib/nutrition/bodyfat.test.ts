import { describe, expect, it } from 'vitest';
import { BODY_TYPE_GUIDE, bodyFatCategory, leanAndFatMass, navyBodyFat, rfmBodyFat } from './bodyfat';

describe('navyBodyFat', () => {
  it('matches hand-computed US Navy examples', () => {
    // 495 / (1.0324 - 0.19077*log10(45) + 0.15456*log10(180)) - 450 = 14.53
    expect(navyBodyFat({ sex: 'male', heightCm: 180, neckCm: 40, waistCm: 85 })).toBeCloseTo(14.53, 1);
    // 495 / (1.29579 - 0.35004*log10(140) + 0.221*log10(165)) - 450 = 28.43
    expect(navyBodyFat({ sex: 'female', heightCm: 165, neckCm: 33, waistCm: 75, hipCm: 98 })).toBeCloseTo(28.43, 1);
  });

  it('rises with waist and falls with neck', () => {
    const base = navyBodyFat({ sex: 'male', heightCm: 180, neckCm: 40, waistCm: 85 })!;
    expect(navyBodyFat({ sex: 'male', heightCm: 180, neckCm: 40, waistCm: 95 })!).toBeGreaterThan(base);
    expect(navyBodyFat({ sex: 'male', heightCm: 180, neckCm: 43, waistCm: 85 })!).toBeLessThan(base);
  });

  it('returns null for missing or impossible measurements', () => {
    expect(navyBodyFat({ sex: 'male', heightCm: 180, neckCm: 40 })).toBeNull();
    expect(navyBodyFat({ sex: 'male', heightCm: 180, neckCm: 40, waistCm: 39 })).toBeNull();
    expect(navyBodyFat({ sex: 'female', heightCm: 165, neckCm: 33, waistCm: 75 })).toBeNull(); // hips required
    expect(navyBodyFat({ sex: 'male', heightCm: 18, neckCm: 40, waistCm: 85 })).toBeNull(); // metres typed as cm
    expect(navyBodyFat({ sex: 'male', heightCm: 180, neckCm: 40, waistCm: 41 })).toBeNull(); // < 3 %
  });
});

describe('rfmBodyFat', () => {
  it('uses height and waist only', () => {
    expect(rfmBodyFat({ sex: 'male', heightCm: 180, waistCm: 85 })).toBeCloseTo(64 - (20 * 180) / 85, 5);
    expect(rfmBodyFat({ sex: 'female', heightCm: 165, waistCm: 75 })).toBeCloseTo(32, 5);
    expect(rfmBodyFat({ sex: 'female', heightCm: 165 })).toBeNull();
  });
});

describe('guide and composition', () => {
  it('maps percentages to bands, including edges and extremes', () => {
    expect(bodyFatCategory('male', 12)).toBe('Lean');
    expect(bodyFatCategory('male', 14.6)).toBe('Lean');
    expect(bodyFatCategory('male', 15)).toBe('Fit');
    expect(bodyFatCategory('male', 4)).toBe('Very lean');
    expect(bodyFatCategory('female', 55)).toBe('High');
    for (const sex of ['male', 'female'] as const) {
      for (const b of BODY_TYPE_GUIDE[sex]) expect(b.midpoint).toBeGreaterThanOrEqual(b.min);
    }
  });

  it('splits weight into lean and fat mass', () => {
    expect(leanAndFatMass(80, 20)).toEqual({ leanKg: 64, fatKg: 16 });
  });
});
