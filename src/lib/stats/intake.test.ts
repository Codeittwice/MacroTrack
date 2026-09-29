import { describe, it, expect } from 'vitest';
import { adherence, averageIntake } from './intake';

describe('adherence', () => {
  it('returns null for empty daily', () => {
    expect(adherence([], 2000)).toBeNull();
  });

  it('returns null for target 0 or non-finite', () => {
    expect(adherence([{ kcal: 2000 }], 0)).toBeNull();
    expect(adherence([{ kcal: 2000 }], NaN)).toBeNull();
    expect(adherence([{ kcal: 2000 }], -100)).toBeNull();
  });

  it('counts exact ±10% boundaries as adherent', () => {
    // target 2000 -> [1800, 2200]
    expect(adherence([{ kcal: 1800 }, { kcal: 2200 }], 2000)).toBe(100);
  });

  it('excludes values just outside the boundary', () => {
    expect(adherence([{ kcal: 1799 }, { kcal: 2201 }], 2000)).toBe(0);
  });

  it('computes a mixed percentage', () => {
    const daily = [{ kcal: 2000 }, { kcal: 1000 }, { kcal: 1900 }, { kcal: 3000 }];
    // 2000 (in), 1000 (out), 1900 (in), 3000 (out) -> 50%
    expect(adherence(daily, 2000)).toBe(50);
  });
});

describe('averageIntake', () => {
  it('averages only logged days within the window', () => {
    const daily = [
      { date: '2026-01-08', kcal: 2000 },
      { date: '2026-01-09', kcal: 2200 },
      { date: '2026-01-10', kcal: 1800 },
    ];
    // window of 3 days ending 2026-01-10: 08,09,10 all included
    expect(averageIntake(daily, 3, '2026-01-10')).toBe(2000);
  });

  it('ignores days outside the window', () => {
    const daily = [
      { date: '2026-01-01', kcal: 5000 }, // way outside
      { date: '2026-01-09', kcal: 2000 },
      { date: '2026-01-10', kcal: 2000 },
    ];
    expect(averageIntake(daily, 2, '2026-01-10')).toBe(2000);
  });

  it('returns null when no logged days fall in the window', () => {
    const daily = [{ date: '2026-01-01', kcal: 2000 }];
    expect(averageIntake(daily, 2, '2026-01-10')).toBeNull();
  });

  it('returns null when days <= 0', () => {
    const daily = [{ date: '2026-01-10', kcal: 2000 }];
    expect(averageIntake(daily, 0, '2026-01-10')).toBeNull();
    expect(averageIntake(daily, -5, '2026-01-10')).toBeNull();
  });

  it('defaults today to the current date when omitted', () => {
    // Just verify it runs and returns a number or null without throwing.
    const result = averageIntake([{ date: '2020-01-01', kcal: 2000 }], 7);
    expect(result).toBeNull();
  });
});
