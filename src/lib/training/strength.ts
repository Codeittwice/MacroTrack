import type { DateKey, Workout, WorkoutSet } from '@/db/types';
import { isHardSet, type ExerciseLookup } from './volume';

/** Estimated one-rep max (Epley). Single reps return the weight itself. */
export function e1rm(kg: number, reps: number): number {
  if (!(kg > 0) || !(reps > 0)) return 0;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

export interface PersonalRecords {
  heaviest?: { kg: number; reps: number; date: DateKey };
  bestE1rm?: { value: number; kg: number; reps: number; date: DateKey };
  mostReps?: { reps: number; kg: number; date: DateKey };
}

/** Records for one exercise across finished workouts (oldest to newest order doesn't matter). */
export function personalRecords(workouts: Workout[], exerciseId: string): PersonalRecords {
  const pr: PersonalRecords = {};
  for (const w of workouts) {
    if (w.deletedAt) continue;
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of ex.sets) {
        if (!isHardSet(s) || !s.reps) continue;
        const kg = s.kg ?? 0;
        if (kg > 0 && (!pr.heaviest || kg > pr.heaviest.kg || (kg === pr.heaviest.kg && s.reps > pr.heaviest.reps))) pr.heaviest = { kg, reps: s.reps, date: w.date };
        const est = e1rm(kg, s.reps);
        if (est > 0 && (!pr.bestE1rm || est > pr.bestE1rm.value)) pr.bestE1rm = { value: est, kg, reps: s.reps, date: w.date };
        if (!pr.mostReps || s.reps > pr.mostReps.reps) pr.mostReps = { reps: s.reps, kg, date: w.date };
      }
    }
  }
  return pr;
}

/** PRs set in `workout` compared with everything before it. */
export function newRecordsIn(workout: Workout, history: Workout[]): { exerciseId: string; name: string; kind: 'heaviest' | 'e1rm' }[] {
  const before = history.filter((w) => w.id !== workout.id && !w.deletedAt && w.startedAt < workout.startedAt);
  const out: { exerciseId: string; name: string; kind: 'heaviest' | 'e1rm' }[] = [];
  for (const ex of workout.exercises) {
    const old = personalRecords(before, ex.exerciseId);
    const now = personalRecords([workout], ex.exerciseId);
    if (!old.bestE1rm && !old.heaviest) continue; // first time is not a "record"
    if (now.heaviest && (!old.heaviest || now.heaviest.kg > old.heaviest.kg)) out.push({ exerciseId: ex.exerciseId, name: ex.name, kind: 'heaviest' });
    else if (now.bestE1rm && (!old.bestE1rm || now.bestE1rm.value > old.bestE1rm.value + 0.01)) out.push({ exerciseId: ex.exerciseId, name: ex.name, kind: 'e1rm' });
  }
  return out;
}

/** Sets from the most recent earlier workout containing this exercise, for "last time" hints. */
export function previousSets(workouts: Workout[], exerciseId: string, beforeStartedAt: number): WorkoutSet[] | undefined {
  const prior = workouts
    .filter((w) => !w.deletedAt && w.startedAt < beforeStartedAt && w.exercises.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => b.startedAt - a.startedAt)[0];
  return prior?.exercises.find((e) => e.exerciseId === exerciseId)?.sets.filter((s) => s.done);
}

/** Best e1RM per workout date for charts. */
export function e1rmHistory(workouts: Workout[], exerciseId: string): { date: DateKey; value: number }[] {
  return workouts
    .filter((w) => !w.deletedAt)
    .map((w) => ({ date: w.date, value: personalRecords([w], exerciseId).bestE1rm?.value ?? 0 }))
    .filter((p) => p.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Informational energy estimate: MET × body weight × hours, using each exercise's share of the
 * session by set count. Never used for targets (the adaptive expenditure already includes training).
 */
export function estimatedBurnKcal(workout: Workout, bodyKg: number, lookup: ExerciseLookup): number {
  if (!workout.finishedAt || !(bodyKg > 0)) return 0;
  const hours = Math.max(0, workout.finishedAt - workout.startedAt) / 3_600_000;
  const weighted = workout.exercises.map((ex) => ({ met: lookup(ex.exerciseId)?.met ?? 5, n: Math.max(1, ex.sets.filter((s) => s.done).length) }));
  const total = weighted.reduce((a, b) => a + b.n, 0);
  const met = total ? weighted.reduce((a, b) => a + b.met * b.n, 0) / total : 5;
  return Math.round(met * bodyKg * hours);
}
