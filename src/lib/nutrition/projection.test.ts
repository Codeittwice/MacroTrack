import { describe, it, expect } from 'vitest';
import { projectGoalDate } from './projection';
import { addDays } from '@/lib/utils/date';

describe('projectGoalDate', () => {
  it('returns null when moving away from the goal', () => {
    // goal is below current, but rate is positive (gaining)
    expect(projectGoalDate(80, 75, 0.5, '2026-01-01')).toBeNull();
    // goal is above current, but rate is negative (losing)
    expect(projectGoalDate(75, 80, -0.5, '2026-01-01')).toBeNull();
  });

  it('returns null when the rate is 0 (and not already at goal)', () => {
    expect(projectGoalDate(80, 75, 0, '2026-01-01')).toBeNull();
  });

  it('returns null when the horizon exceeds 10 years', () => {
    // 1 kg to go at an absurdly slow rate -> far more than 3650 days
    expect(projectGoalDate(80, 79, 0.0001, '2026-01-01')).toBeNull();
  });

  it('returns `from` when already at the goal (within 0.05 kg)', () => {
    expect(projectGoalDate(80, 80, -0.5, '2026-01-01')).toBe('2026-01-01');
    expect(projectGoalDate(80, 80.04, -0.5, '2026-01-01')).toBe('2026-01-01');
    expect(projectGoalDate(80.04, 80, 0.5, '2026-01-01')).toBe('2026-01-01');
  });

  it('computes the normal losing case: 80 -> 75 at -0.5 kg/wk from 2026-01-01', () => {
    // diff = -5, rate = -0.5/wk -> days = ceil((-5 / -0.5) * 7) = ceil(70) = 70
    const result = projectGoalDate(80, 75, -0.5, '2026-01-01');
    expect(result).toBe(addDays('2026-01-01', 70));
    expect(result).toBe('2026-03-12');
  });

  it('computes a gaining case', () => {
    // diff = +5, rate = +0.25/wk -> days = ceil((5/0.25)*7) = 140
    const result = projectGoalDate(75, 80, 0.25, '2026-01-01');
    expect(result).toBe(addDays('2026-01-01', 140));
  });

  it('returns null for non-finite current/goal/rate', () => {
    expect(projectGoalDate(NaN, 75, -0.5, '2026-01-01')).toBeNull();
    expect(projectGoalDate(80, NaN, -0.5, '2026-01-01')).toBeNull();
    expect(projectGoalDate(80, 75, NaN, '2026-01-01')).toBeNull();
    expect(projectGoalDate(Infinity, 75, -0.5, '2026-01-01')).toBeNull();
  });
});
