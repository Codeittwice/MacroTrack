import { describe, expect, it } from 'vitest';
import type { ExerciseDef, Workout } from '@/db/types';
import { LANDMARKS, volumeAdvice, volumeBand, weekStart, weeklyHistory } from './volume';

const bench: ExerciseDef = { id: 'bench', name: 'Bench press', primary: ['chest'], secondary: ['triceps'], equipment: 'barbell', kind: 'strength' } as ExerciseDef;
const lookup = (id: string) => (id === 'bench' ? bench : undefined);
const set = { type: 'working', done: true, reps: 8, kg: 60 };
const workout = (date: string, sets: number): Workout => ({
  id: date, date, startedAt: 0, finishedAt: 1, updatedAt: 0, name: 'Push',
  exercises: [{ exerciseId: 'bench', name: 'Bench press', sets: Array.from({ length: sets }, () => ({ ...set })) }],
} as unknown as Workout);

describe('volume landmarks', () => {
  it('has ordered landmarks for every muscle', () => {
    for (const l of Object.values(LANDMARKS)) {
      expect(l.mev).toBeLessThanOrEqual(l.low);
      expect(l.low).toBeLessThan(l.high);
      expect(l.high).toBeLessThanOrEqual(l.mrv);
    }
  });

  it('bands weekly sets against the muscle', () => {
    expect(volumeBand('chest', 0)).toBe('none');
    expect(volumeBand('chest', 4)).toBe('under');
    expect(volumeBand('chest', 10)).toBe('building');
    expect(volumeBand('chest', 16)).toBe('optimal');
    expect(volumeBand('chest', 21)).toBe('high');
    expect(volumeBand('chest', 30)).toBe('over');
    // The same 10 sets are plenty for triceps.
    expect(volumeBand('triceps', 10)).toBe('optimal');
    expect(volumeAdvice('chest', 4)).toContain('add 4');
  });

  it('starts weeks on Monday', () => {
    expect(weekStart('2026-09-30')).toBe('2026-09-28'); // Wednesday
    expect(weekStart('2026-09-28')).toBe('2026-09-28'); // Monday
    expect(weekStart('2026-10-04')).toBe('2026-09-28'); // Sunday
  });

  it('sums sets per rolling 7-day block ending today, helper muscles at half', () => {
    const history = weeklyHistory([workout('2026-09-22', 5), workout('2026-09-24', 3), workout('2026-09-29', 4), workout('2026-09-30', 4)], '2026-09-30', 3, lookup);
    expect(history.map((w) => [w.weekStart, w.weekEnd])).toEqual([['2026-09-10', '2026-09-16'], ['2026-09-17', '2026-09-23'], ['2026-09-24', '2026-09-30']]);
    expect(history[0].sets.chest).toBeUndefined();
    expect(history[1].sets.chest).toBe(5);
    expect(history[2].sets).toEqual({ chest: 11, triceps: 5.5 });
  });
});
