import type { DateKey, ExerciseDef, Muscle, Workout } from '@/db/types';
import { addDays } from '@/lib/utils/date';

/** Weekly hard-set guideline per muscle for hypertrophy (roughly 10–20). */
export const WEEKLY_SET_TARGET = { min: 10, max: 20 } as const;

/** A set counts toward volume when it's a completed working set (warm-ups are excluded). */
export const isHardSet = (set: { type: string; done: boolean }) => set.done && set.type === 'working';

export type ExerciseLookup = (id: string) => ExerciseDef | undefined;

export interface MuscleVolume {
  sets: number;
  /** per exercise: hard sets credited to this muscle */
  exercises: { exerciseId: string; name: string; sets: number }[];
}

/** Hard sets per muscle for the given workouts: primary muscles get 1 per set, secondary 0.5. */
export function setsByMuscle(workouts: Workout[], lookup: ExerciseLookup): Partial<Record<Muscle, MuscleVolume>> {
  const out: Partial<Record<Muscle, MuscleVolume>> = {};
  const credit = (muscle: Muscle, exerciseId: string, name: string, sets: number) => {
    const entry = (out[muscle] ??= { sets: 0, exercises: [] });
    entry.sets += sets;
    const ex = entry.exercises.find((e) => e.exerciseId === exerciseId);
    if (ex) ex.sets += sets;
    else entry.exercises.push({ exerciseId, name, sets });
  };
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const def = lookup(ex.exerciseId);
      if (!def || def.kind === 'cardio') continue;
      const hard = ex.sets.filter(isHardSet).length;
      if (!hard) continue;
      for (const m of def.primary) credit(m, ex.exerciseId, ex.name, hard);
      for (const m of def.secondary) credit(m, ex.exerciseId, ex.name, hard * 0.5);
    }
  }
  for (const v of Object.values(out)) v?.exercises.sort((a, b) => b.sets - a.sets);
  return out;
}

/** Workouts in the 7 days ending on `endDate` (inclusive). */
export function lastWeek(workouts: Workout[], endDate: DateKey): Workout[] {
  const start = addDays(endDate, -6);
  return workouts.filter((w) => !w.deletedAt && w.date >= start && w.date <= endDate);
}

export const weeklySetsByMuscle = (workouts: Workout[], endDate: DateKey, lookup: ExerciseLookup) => setsByMuscle(lastWeek(workouts, endDate), lookup);

/** Total kg × reps over completed working sets. */
export function volumeLoad(workout: Workout): number {
  let total = 0;
  for (const ex of workout.exercises) for (const s of ex.sets) if (isHardSet(s) && s.kg && s.reps) total += s.kg * s.reps;
  return total;
}

export function hardSetCount(workout: Workout): number {
  return workout.exercises.reduce((n, ex) => n + ex.sets.filter(isHardSet).length, 0);
}
