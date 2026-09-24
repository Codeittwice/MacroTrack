import { describe, it, expect } from 'vitest';
import { currentExpenditure } from './expenditure';
import type { Profile, WeightEntry } from '@/db/types';
import { addDays } from '@/lib/utils/date';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p1',
    updatedAt: 0,
    sex: 'male',
    birthDate: '1990-01-01',
    heightCm: 180,
    startWeightKg: 80,
    activity: 'moderate',
    goal: 'maintain',
    goalRatePctPerWeek: 0,
    diet: 'balanced',
    checkInWeekday: 1,
    onboardedAt: 0,
    ...overrides,
  };
}

function makeWeight(date: string, kg: number): WeightEntry {
  return { id: `w-${date}`, updatedAt: 0, date, kg };
}

describe('currentExpenditure', () => {
  it('returns prior with low confidence when fewer than 10 logged days', () => {
    const profile = makeProfile();
    const weights = [makeWeight('2026-01-01', 80), makeWeight('2026-01-05', 80)];
    const intake = [{ date: '2026-01-05', kcal: 2000 }];
    const result = currentExpenditure({ profile, weights, intake, today: '2026-01-05' });
    expect(result.confidence).toBe('low');
    expect(result.daysUsed).toBeLessThan(10);
    expect(Number.isFinite(result.expenditure)).toBe(true);
  });

  it('uses `previous` as the prior instead of the formula TDEE', () => {
    const profile = makeProfile();
    const weights = [makeWeight('2026-01-01', 80), makeWeight('2026-01-05', 80)];
    const intake = [{ date: '2026-01-05', kcal: 2000 }];
    const withPrevious = currentExpenditure({ profile, weights, intake, today: '2026-01-05', previous: 3333 });
    const withoutPrevious = currentExpenditure({ profile, weights, intake, today: '2026-01-05' });
    expect(withPrevious.expenditure).toBe(3333);
    expect(withoutPrevious.expenditure).not.toBe(3333);
  });

  it('returns a finite result when there are no weights at all', () => {
    const profile = makeProfile();
    const result = currentExpenditure({ profile, weights: [], intake: [], today: '2026-01-10' });
    expect(result.confidence).toBe('low');
    expect(result.daysUsed).toBe(0);
    expect(Number.isFinite(result.expenditure)).toBe(true);
    expect(result.expenditure).toBeGreaterThan(0);
  });

  it('estimates expenditure near steady intake for a stable-weight 21-day window', () => {
    const profile = makeProfile();
    const start = '2026-01-01';
    const end = '2026-01-21';
    const weights: WeightEntry[] = [];
    const intake: { date: string; kcal: number }[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      weights.push(makeWeight(d, 75)); // perfectly stable weight -> zero slope
      intake.push({ date: d, kcal: 2500 });
    }
    const result = currentExpenditure({ profile, weights, intake, today: end, previous: 2500 });
    expect(result.daysUsed).toBe(21);
    expect(result.confidence).not.toBe('low');
    expect(result.expenditure).toBeGreaterThan(2400);
    expect(result.expenditure).toBeLessThan(2600);
  });
});
