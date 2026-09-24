import { describe, it, expect } from 'vitest';
import { trendChangeOverDays, averageWeeklyRate, trendExtremes, isTowardGoal } from './stats';
import type { DailyPoint } from '@/lib/nutrition';

function series(start: string, values: number[]): DailyPoint[] {
  const out: DailyPoint[] = [];
  const [y, m, d] = start.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  values.forEach((value, i) => {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + i);
    const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    out.push({ date, value });
  });
  return out;
}

describe('trendChangeOverDays', () => {
  it('returns undefined for an empty trend', () => {
    expect(trendChangeOverDays([], 7)).toBeUndefined();
  });

  it('returns undefined when there is no point far enough back', () => {
    const trend = series('2026-01-01', [80, 79.9, 79.8]);
    expect(trendChangeOverDays(trend, 7)).toBeUndefined();
  });

  it('computes the change over N days when the point exists', () => {
    const trend = series('2026-01-01', Array.from({ length: 10 }, (_, i) => 80 - i * 0.1));
    // latest = day 9 -> 79.1; 7 days back = day 2 -> 79.8; diff = -0.7
    const result = trendChangeOverDays(trend, 7);
    expect(result).not.toBeUndefined();
    expect(result!).toBeCloseTo(-0.7, 5);
  });
});

describe('averageWeeklyRate', () => {
  it('returns undefined for fewer than 2 points', () => {
    expect(averageWeeklyRate([])).toBeUndefined();
    expect(averageWeeklyRate(series('2026-01-01', [80]))).toBeUndefined();
  });

  it('returns undefined when span is less than 7 days', () => {
    const trend = series('2026-01-01', [80, 79.9, 79.8]);
    expect(averageWeeklyRate(trend)).toBeUndefined();
  });

  it('computes the average weekly rate over the whole history', () => {
    // 14 days, -0.05/day -> -0.35/week average
    const trend = series('2026-01-01', Array.from({ length: 15 }, (_, i) => 80 - i * 0.05));
    const result = averageWeeklyRate(trend);
    expect(result).not.toBeUndefined();
    expect(result!).toBeCloseTo(-0.35, 5);
  });
});

describe('trendExtremes', () => {
  it('returns undefined for an empty trend', () => {
    expect(trendExtremes([])).toBeUndefined();
  });

  it('finds the lowest and highest trend values with dates', () => {
    const trend = series('2026-01-01', [80, 78, 82, 79]);
    const result = trendExtremes(trend);
    expect(result).toEqual({
      lowest: { value: 78, date: '2026-01-02' },
      highest: { value: 82, date: '2026-01-03' },
    });
  });
});

describe('isTowardGoal', () => {
  it('returns undefined for a non-finite rate', () => {
    expect(isTowardGoal(NaN, 80, 75, 'lose')).toBeUndefined();
  });

  it('treats tiny rates as flat', () => {
    expect(isTowardGoal(0.01, 80, 75, 'lose')).toBe('flat');
    expect(isTowardGoal(-0.01, 80, 75, 'lose')).toBe('flat');
  });

  it('uses goalWeightKg when set: toward when sign matches', () => {
    // losing toward a lower goal
    expect(isTowardGoal(-0.3, 80, 75, undefined)).toBe('toward');
    // gaining away from a lower goal
    expect(isTowardGoal(0.3, 80, 75, undefined)).toBe('away');
    // gaining toward a higher goal
    expect(isTowardGoal(0.3, 70, 75, undefined)).toBe('toward');
  });

  it('treats being within 0.05 kg of the goal as flat', () => {
    expect(isTowardGoal(0.3, 75.02, 75, undefined)).toBe('flat');
  });

  it('falls back to goal type when goalWeightKg is missing', () => {
    expect(isTowardGoal(-0.3, undefined, undefined, 'lose')).toBe('toward');
    expect(isTowardGoal(0.3, undefined, undefined, 'lose')).toBe('away');
    expect(isTowardGoal(0.3, undefined, undefined, 'gain')).toBe('toward');
    expect(isTowardGoal(-0.3, undefined, undefined, 'gain')).toBe('away');
    expect(isTowardGoal(0.08, undefined, undefined, 'maintain')).toBe('toward');
    expect(isTowardGoal(0.3, undefined, undefined, 'maintain')).toBe('away');
  });

  it('returns undefined when neither goalWeightKg nor goalType are available', () => {
    expect(isTowardGoal(-0.3, 80, undefined, undefined)).toBeUndefined();
  });
});
