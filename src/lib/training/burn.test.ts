import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { newRecord } from '@/db/repo';
import type { Workout } from '@/db/types';
import { exerciseBonusKcal } from './burn';
import { builtInExercise } from './exercises';

beforeEach(async () => {
  await Promise.all([db.workouts.clear(), db.weights.clear(), db.exercises.clear()]);
});

describe('exercise calorie bonus', () => {
  it('is 0 when off, and half or full of the net burn otherwise', async () => {
    await db.weights.put(newRecord({ date: '2026-09-28', kg: 80, time: 0 }) as never);
    const start = Date.parse('2026-09-29T18:00:00');
    await db.workouts.put(newRecord({
      date: '2026-09-29', startedAt: start, finishedAt: start + 1_800_000, name: 'Run',
      exercises: [{ exerciseId: 'running', name: 'Running', sets: [{ durationSec: 1800, type: 'working', done: true }] }],
    }) as Workout);
    const full = Math.round((builtInExercise('running')!.met! - 1) * 80 * 0.5);
    expect(await exerciseBonusKcal('2026-09-29', 'off')).toBe(0);
    expect(await exerciseBonusKcal('2026-09-29', 'full')).toBe(full);
    expect(await exerciseBonusKcal('2026-09-29', 'half')).toBe(Math.round(full / 2));
    expect(await exerciseBonusKcal('2026-09-30', 'full')).toBe(0);
  });
});
