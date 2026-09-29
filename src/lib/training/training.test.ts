import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import type { Workout } from '@/db/types';
import { addExercise, addSet, finishWorkout, saveTemplate, startWorkout, updateSet, createCustomExercise, repeatWorkout, logPastWorkout, updateWorkoutTiming, tidyWorkout, localTimestamp, timeOf } from './actions';
import { addDays, today } from '@/lib/utils/date';
import { BUILT_IN_EXERCISES, builtInExercise } from './exercises';
import { e1rm, estimatedBurnKcal, newRecordsIn, personalRecords, previousSets } from './strength';
import { hardSetCount, setsByMuscle, volumeLoad, weeklySetsByMuscle } from './volume';

const lookup = builtInExercise;
const bench = builtInExercise('bench-press')!;

function workout(date: string, startedAt: number, sets: { kg: number; reps: number; type?: 'warmup' | 'working'; done?: boolean }[], exerciseId = 'bench-press'): Workout {
  return {
    id: `w${startedAt}`, updatedAt: 0, date, startedAt, finishedAt: startedAt + 3_600_000, name: 'Test',
    exercises: [{ exerciseId, name: lookup(exerciseId)!.name, sets: sets.map((s) => ({ kg: s.kg, reps: s.reps, type: s.type ?? 'working', done: s.done ?? true })) }],
  };
}

beforeEach(async () => {
  await db.workouts.clear();
  await db.workoutTemplates.clear();
  await db.exercises.clear();
});

describe('exercise library', () => {
  it('has unique ids and every exercise trains something', () => {
    const ids = BUILT_IN_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(BUILT_IN_EXERCISES.length).toBeGreaterThan(90);
    for (const e of BUILT_IN_EXERCISES) expect(e.primary.length).toBeGreaterThan(0);
  });
});

describe('volume', () => {
  it('credits primary muscles 1 and secondary 0.5 per completed working set', () => {
    const w = workout('2026-09-28', 1, [{ kg: 20, reps: 10, type: 'warmup' }, { kg: 80, reps: 8 }, { kg: 80, reps: 8 }, { kg: 80, reps: 6, done: false }]);
    const v = setsByMuscle([w], lookup);
    expect(v.chest?.sets).toBe(2);
    expect(v.triceps?.sets).toBe(1);
    expect(v.frontDelts?.sets).toBe(1);
    expect(v.chest?.exercises[0]).toMatchObject({ exerciseId: 'bench-press', sets: 2 });
    expect(hardSetCount(w)).toBe(2);
    expect(volumeLoad(w)).toBe(1280);
  });

  it('counts only the last 7 days and skips cardio', () => {
    const old = workout('2026-09-20', 1, [{ kg: 80, reps: 8 }]);
    const recent = workout('2026-09-22', 2, [{ kg: 80, reps: 8 }]);
    const run = workout('2026-09-28', 3, [{ kg: 0, reps: 1 }], 'running');
    const v = weeklySetsByMuscle([old, recent, run], '2026-09-28', lookup);
    expect(v.chest?.sets).toBe(1);
    expect(v.quads).toBeUndefined();
  });
});

describe('strength', () => {
  it('estimates one-rep max with Epley', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1);
    expect(e1rm(0, 5)).toBe(0);
  });

  it('finds personal records and new records in a session', () => {
    const a = workout('2026-09-01', 1, [{ kg: 80, reps: 8 }]);
    const b = workout('2026-09-08', 2, [{ kg: 85, reps: 5 }]);
    const c = workout('2026-09-15', 3, [{ kg: 82.5, reps: 8 }]);
    const pr = personalRecords([a, b, c], 'bench-press');
    expect(pr.heaviest?.kg).toBe(85);
    expect(pr.bestE1rm?.kg).toBe(82.5);
    expect(newRecordsIn(b, [a, b, c]).map((r) => r.kind)).toEqual(['heaviest']);
    expect(newRecordsIn(c, [a, b, c]).map((r) => r.kind)).toEqual(['e1rm']);
    expect(newRecordsIn(a, [a, b, c])).toEqual([]); // first session is not a record
    expect(previousSets([a, b, c], 'bench-press', 3)?.[0].kg).toBe(85);
  });

  it('estimates net burn: strength from session time, cardio from logged minutes', () => {
    const w = workout('2026-09-28', 0, [{ kg: 80, reps: 8 }]);
    expect(estimatedBurnKcal(w, 80, lookup)).toBe(Math.round((bench.met! - 1) * 80 * 1)); // 1 h strength
    const run: Workout = { ...w, exercises: [...w.exercises, { exerciseId: 'running', name: 'Running', sets: [{ durationSec: 1800, type: 'working', done: true }] }] };
    const running = builtInExercise('running')!;
    // 30 min running + remaining 30 min of strength
    expect(estimatedBurnKcal(run, 80, lookup)).toBe(Math.round((running.met! - 1) * 80 * 0.5 + (bench.met! - 1) * 80 * 0.5));
  });
});

describe('workout actions', () => {
  it('keeps sets that were filled in but not ticked when finishing', async () => {
    const w = await startWorkout({ name: 'Pull' });
    await addExercise(w.id, bench, 3);
    await updateSet(w.id, 0, 0, { kg: 60, reps: 10, done: true });
    await updateSet(w.id, 0, 1, { kg: 60, reps: 9 }); // typed, tick box not tapped
    const done = await finishWorkout(w.id); // set 3 was left blank
    expect(done.exercises[0].sets.map((s) => [s.reps, s.done])).toEqual([[10, true], [9, true]]);
  });

  it('logs a workout, drops unfinished sets on finish, and round-trips through a template', async () => {
    const w = await startWorkout({ name: 'Push' });
    await addExercise(w.id, bench, 2);
    await updateSet(w.id, 0, 0, { kg: 80, reps: 8, done: true });
    await addSet(w.id, 0);
    await updateSet(w.id, 0, 2, { kg: 80, reps: 7, done: true });
    const done = await finishWorkout(w.id);
    expect(done.finishedAt).toBeDefined();
    expect(done.exercises[0].sets).toHaveLength(2);

    const t = await saveTemplate(done, 'Push day');
    expect(t.exercises[0]).toMatchObject({ exerciseId: 'bench-press', sets: 2, repMin: 7, repMax: 8 });
    const next = await startWorkout({ template: t });
    expect(next.exercises[0].sets).toHaveLength(2);
    expect(next.templateId).toBe(t.id);
    const again = await repeatWorkout(done);
    expect(again.exercises[0].exerciseId).toBe('bench-press');
  });

  it('creates custom exercises with a muscle', async () => {
    await expect(createCustomExercise({ name: 'Landmine press', equipment: 'barbell', primary: [], secondary: [], kind: 'strength' })).rejects.toThrow('main muscle');
    const ex = await createCustomExercise({ name: 'Landmine press', equipment: 'barbell', primary: ['frontDelts'], secondary: ['chest'], kind: 'strength' });
    expect(ex.id.startsWith('custom:')).toBe(true);
  });
});

describe('concurrent edits', () => {
  it('keeps every set when updates fire without awaiting (fast typing)', async () => {
    const w = await startWorkout();
    await addExercise(w.id, bench, 3);
    await Promise.all([0, 1, 2].flatMap((i) => [updateSet(w.id, 0, i, { kg: 80 }), updateSet(w.id, 0, i, { reps: 8 }), updateSet(w.id, 0, i, { done: true })]));
    const saved = await db.workouts.get(w.id);
    expect(saved!.exercises[0].sets.every((s) => s.kg === 80 && s.reps === 8 && s.done)).toBe(true);
  });
});

describe('activity sessions', () => {
  it('summarises sports by minutes and burn instead of sets', async () => {
    const { activeMinutes, sessionSummary } = await import('./volume');
    const w: Workout = {
      id: 'v', updatedAt: 0, date: '2026-09-29', startedAt: 0, finishedAt: 5_400_000, name: 'Volleyball',
      exercises: [{ exerciseId: 'volleyball', name: 'Volleyball', sets: [{ durationSec: 5400, type: 'working', done: true }] }],
    };
    expect(hardSetCount(w)).toBe(0);
    expect(activeMinutes(w, lookup)).toBe(90);
    expect(sessionSummary(w, lookup, 560)).toBe('90 min active · ~560 kcal');
    const mixed: Workout = { ...w, exercises: [...workout('2026-09-29', 1, [{ kg: 80, reps: 8 }]).exercises, ...w.exercises] };
    expect(sessionSummary(mixed, lookup)).toBe('1 set · 640 kg · 90 min active');
  });
});

describe('past workouts', () => {
  it('logs a finished workout on an earlier day and counts its sets once filled in', async () => {
    const date = addDays(today(), -3);
    const w = await logPastWorkout({ date, time: '07:30', durationMin: 45, name: 'Legs' });
    expect(w.date).toBe(date);
    expect(w.startedAt).toBe(localTimestamp(date, '07:30'));
    expect(w.finishedAt! - w.startedAt).toBe(45 * 60_000);
    await addExercise(w.id, builtInExercise('back-squat')!, 3);
    await updateSet(w.id, 0, 0, { kg: 100, reps: 5 });
    await updateSet(w.id, 0, 1, { kg: 100, reps: 5 });
    const saved = await tidyWorkout(w.id);
    expect(saved.exercises[0].sets).toHaveLength(2); // the blank third set is dropped
    expect(saved.exercises[0].sets.every((s) => s.done)).toBe(true);
    expect(hardSetCount(saved)).toBe(2);
  });

  it('refuses a future date', async () => {
    await expect(logPastWorkout({ date: addDays(today(), 1), time: '10:00', durationMin: 30 })).rejects.toThrow();
  });

  it('pre-fills a template and adds new sets as done', async () => {
    const t = await saveTemplate(workout('2026-01-01', 1, [{ kg: 60, reps: 10 }, { kg: 60, reps: 10 }]), 'Push');
    const w = await logPastWorkout({ date: addDays(today(), -1), time: '18:00', durationMin: 60, template: t });
    expect(w.name).toBe('Push');
    expect(w.exercises[0].sets).toHaveLength(2);
    const after = await addSet(w.id, 0);
    expect(after.exercises[0].sets[2].done).toBe(true);
  });

  it('moves a workout to another day and time, keeping the duration', async () => {
    const w = await logPastWorkout({ date: addDays(today(), -1), time: '18:00', durationMin: 50 });
    const target = addDays(today(), -5);
    let moved = await updateWorkoutTiming(w.id, { date: target, time: '06:15' });
    expect(moved.date).toBe(target);
    expect(timeOf(moved.startedAt)).toBe('06:15');
    expect(moved.finishedAt! - moved.startedAt).toBe(50 * 60_000);
    moved = await updateWorkoutTiming(w.id, { durationMin: 70 });
    expect(moved.finishedAt! - moved.startedAt).toBe(70 * 60_000);
    moved = await updateWorkoutTiming(w.id, { date: addDays(today(), 2) });
    expect(moved.date).toBe(target); // future dates are ignored
  });
});
