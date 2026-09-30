import type { DateKey, ExerciseDef, Muscle, Workout } from '@/db/types';
import { addDays, fromDateKey } from '@/lib/utils/date';

/** Weekly hard-set guideline per muscle for hypertrophy (roughly 10–20), used where no muscle is known. */
export const WEEKLY_SET_TARGET = { min: 10, max: 20 } as const;

/**
 * Weekly hard-set landmarks per muscle for an intermediate lifter:
 * - mev: minimum effective volume. Below it most people maintain rather than grow.
 * - low–high: the productive range most people grow best in.
 * - mrv: maximum recoverable volume. Above it recovery usually suffers.
 * Based on Renaissance Periodization's volume landmarks and the dose-response data in Schoenfeld,
 * Ogborn and Krieger (2017, J Sports Sci), where 10+ weekly sets beat fewer. Helper muscles already
 * count half a set here, so muscles fed mostly by compounds (front delts, lower back) have low ranges.
 */
export interface VolumeLandmarks { mev: number; low: number; high: number; mrv: number }

export const LANDMARKS: Record<Muscle, VolumeLandmarks> = {
  chest: { mev: 8, low: 12, high: 20, mrv: 22 },
  frontDelts: { mev: 4, low: 6, high: 12, mrv: 16 },
  sideDelts: { mev: 8, low: 12, high: 22, mrv: 26 },
  rearDelts: { mev: 6, low: 10, high: 18, mrv: 22 },
  biceps: { mev: 8, low: 12, high: 20, mrv: 26 },
  triceps: { mev: 6, low: 10, high: 14, mrv: 18 },
  forearms: { mev: 2, low: 6, high: 12, mrv: 16 },
  lats: { mev: 10, low: 14, high: 22, mrv: 25 },
  upperBack: { mev: 8, low: 12, high: 20, mrv: 24 },
  traps: { mev: 4, low: 10, high: 20, mrv: 26 },
  lowerBack: { mev: 2, low: 4, high: 8, mrv: 12 },
  abs: { mev: 4, low: 10, high: 20, mrv: 25 },
  obliques: { mev: 2, low: 6, high: 12, mrv: 16 },
  glutes: { mev: 4, low: 8, high: 14, mrv: 18 },
  quads: { mev: 8, low: 12, high: 18, mrv: 20 },
  hamstrings: { mev: 6, low: 10, high: 16, mrv: 20 },
  adductors: { mev: 2, low: 6, high: 10, mrv: 14 },
  calves: { mev: 8, low: 12, high: 16, mrv: 20 },
  shins: { mev: 2, low: 4, high: 8, mrv: 12 },
};

/**
 * none: not trained; under: below MEV (maintenance at best); building: MEV up to the productive range;
 * optimal: in the productive range; high: above it but recoverable; over: past MRV.
 */
export type VolumeBand = 'none' | 'under' | 'building' | 'optimal' | 'high' | 'over';

export function volumeBand(muscle: Muscle, sets: number): VolumeBand {
  const l = LANDMARKS[muscle];
  if (sets <= 0) return 'none';
  if (sets < l.mev) return 'under';
  if (sets < l.low) return 'building';
  if (sets <= l.high) return 'optimal';
  if (sets <= l.mrv) return 'high';
  return 'over';
}

export const BAND_LABEL: Record<VolumeBand, string> = {
  none: 'Not trained',
  under: 'Too little to grow',
  building: 'Getting there',
  optimal: 'Optimal',
  high: 'High',
  over: 'Too much',
};

/** Advice for a muscle's weekly sets against its landmarks. */
export function volumeAdvice(muscle: Muscle, sets: number): string {
  const l = LANDMARKS[muscle];
  const range = `${l.low}–${l.high}`;
  switch (volumeBand(muscle, sets)) {
    case 'none': return `Not trained this week. ${l.mev}+ sets a week is the minimum that usually grows this muscle; ${range} is the sweet spot.`;
    case 'under': return `Below the ~${l.mev} sets that usually grow this muscle. Enough to maintain; add ${Math.ceil(l.mev - sets)} or more sets to grow.`;
    case 'building': return `Effective, and ${Math.ceil(l.low - sets)} more set${Math.ceil(l.low - sets) === 1 ? '' : 's'} reaches the ${range} range where most people grow best.`;
    case 'optimal': return `In the ${range} sets range where most people grow best.`;
    case 'high': return `Above ${l.high} sets. Productive if you recover well (strength and pumps hold up), but past ~${l.mrv} most people stop recovering.`;
    case 'over': return `Past ~${l.mrv} sets, more than most people can recover from. Trim sets or plan a deload if performance drops.`;
  }
}

/** Monday of the week containing `date`. */
export function weekStart(date: DateKey): DateKey {
  const dow = fromDateKey(date).getDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

export interface WeekVolume {
  /** first day of the 7-day block */
  weekStart: DateKey;
  /** last day of the 7-day block */
  weekEnd: DateKey;
  sets: Partial<Record<Muscle, number>>;
}

/**
 * Hard sets per muscle in consecutive 7-day blocks, oldest first, the last block ending on `endDate`.
 * Rolling blocks (not calendar weeks) so the newest one matches the muscle map's "last 7 days".
 */
export function weeklyHistory(workouts: Workout[], endDate: DateKey, weeks: number, lookup: ExerciseLookup): WeekVolume[] {
  const out: WeekVolume[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = addDays(endDate, -7 * i);
    const start = addDays(end, -6);
    const inWeek = workouts.filter((w) => !w.deletedAt && w.date >= start && w.date <= end);
    const byMuscle = setsByMuscle(inWeek, lookup);
    const sets: Partial<Record<Muscle, number>> = {};
    for (const [m, v] of Object.entries(byMuscle) as [Muscle, MuscleVolume][]) sets[m] = v.sets;
    out.push({ weekStart: start, weekEnd: end, sets });
  }
  return out;
}

/** A set counts toward volume when it's a completed working set (warm-ups are excluded). */
export const isHardSet = (set: { type: string; done: boolean; reps?: number; durationSec?: number }) =>
  set.done && set.type === 'working' && !(set.durationSec && !set.reps); // timed activity entries aren't strength sets

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

/** Minutes logged on cardio and sports entries (completed only). */
export function activeMinutes(workout: Workout, lookup: ExerciseLookup): number {
  let sec = 0;
  for (const ex of workout.exercises) {
    if (lookup(ex.exerciseId)?.kind !== 'cardio') continue;
    for (const s of ex.sets) if (s.done) sec += s.durationSec ?? 0;
  }
  return Math.round(sec / 60);
}

/**
 * One-line session summary: strength parts as sets and kg, activity parts as minutes, plus the
 * estimated burn when given, e.g. "4 sets · 1,920 kg · 30 min active · ~390 kcal".
 */
export function sessionSummary(workout: Workout, lookup: ExerciseLookup, burnKcal?: number): string {
  const parts: string[] = [];
  const sets = hardSetCount(workout);
  if (sets) {
    parts.push(`${sets} ${sets === 1 ? 'set' : 'sets'}`);
    const kg = volumeLoad(workout);
    if (kg) parts.push(`${Math.round(kg).toLocaleString()} kg`);
  }
  const min = activeMinutes(workout, lookup);
  if (min) parts.push(`${min} min active`);
  if (burnKcal) parts.push(`~${burnKcal} kcal`);
  return parts.join(' · ');
}
