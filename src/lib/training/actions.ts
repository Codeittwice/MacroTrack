import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { alive, newRecord } from '@/db/repo';
import type { CustomExercise, ExerciseDef, Workout, WorkoutExercise, WorkoutSet, WorkoutTemplate } from '@/db/types';
import { fromDateKey, toDateKey } from '@/lib/utils/date';
import { normalizeText } from '@/lib/food-sources/normalize';
import { BUILT_IN_EXERCISES, builtInExercise } from './exercises';
import type { ExerciseLookup } from './volume';

// ---- exercises ----

export const customToDef = (c: CustomExercise): ExerciseDef => ({ id: c.id, name: c.name, nameNl: c.nameNl, equipment: c.equipment, primary: c.primary, secondary: c.secondary, kind: c.kind, met: c.met });

export async function createCustomExercise(input: Omit<ExerciseDef, 'id'>): Promise<ExerciseDef> {
  if (!input.name.trim()) throw new Error('Give the exercise a name.');
  if (!input.primary.length) throw new Error('Pick at least one main muscle.');
  const rec = newRecord({ ...input, name: input.name.trim(), id: undefined }) as CustomExercise;
  rec.id = `custom:${rec.id}`;
  await db.exercises.put(rec);
  return customToDef(rec);
}

export function useCustomExercises(): ExerciseDef[] | undefined {
  return useLiveQuery(async () => (await db.exercises.toArray()).filter(alive).map(customToDef), []);
}

/** Lookup over built-in and custom exercises, for volume and history calculations. */
export function useExerciseLookup(): ExerciseLookup {
  const custom = useCustomExercises();
  const map = new Map((custom ?? []).map((e) => [e.id, e]));
  return (id: string) => builtInExercise(id) ?? map.get(id);
}

export function searchExercises(all: ExerciseDef[], query: string, muscle?: string): ExerciseDef[] {
  const q = normalizeText(query);
  return all.filter((e) => {
    if (muscle && !e.primary.includes(muscle as never) && !e.secondary.includes(muscle as never)) return false;
    if (!q) return true;
    const hay = normalizeText(`${e.name} ${e.nameNl ?? ''} ${e.equipment}`);
    return q.split(' ').every((w) => hay.includes(w));
  });
}

export const allExercises = (custom: ExerciseDef[] | undefined) => [...(custom ?? []), ...BUILT_IN_EXERCISES];

// ---- workouts ----

export function useWorkouts(): Workout[] | undefined {
  return useLiveQuery(async () => (await db.workouts.orderBy('startedAt').reverse().toArray()).filter(alive), []);
}

export function useWorkout(id: string | undefined): Workout | null | undefined {
  return useLiveQuery(async () => (id ? (await db.workouts.get(id)) ?? null : null), [id]);
}

/** The unfinished workout, if one is in progress. */
export function useActiveWorkout(): Workout | null | undefined {
  return useLiveQuery(async () => (await db.workouts.toArray()).filter((w) => alive(w) && !w.finishedAt).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null, []);
}

/** Sets added to a finished (past or edited) workout count as done: there is nothing left to tick off. */
const emptySet = (prev?: WorkoutSet, done = false): WorkoutSet => ({ type: 'working', done, kg: prev?.kg, reps: prev?.reps });

export async function startWorkout(opts: { template?: WorkoutTemplate; name?: string } = {}): Promise<Workout> {
  const now = Date.now();
  const exercises: WorkoutExercise[] = (opts.template?.exercises ?? []).map((t) => ({
    exerciseId: t.exerciseId,
    name: t.name,
    sets: Array.from({ length: Math.max(1, t.sets) }, () => emptySet()),
  }));
  const w = newRecord({ date: toDateKey(new Date(now)), startedAt: now, name: opts.name ?? opts.template?.name ?? defaultName(now), templateId: opts.template?.id, exercises }) as Workout;
  await db.workouts.put(w);
  return w;
}

/** `YYYY-MM-DD` + `HH:MM` as a local timestamp. */
export function localTimestamp(date: string, time: string): number {
  const d = fromDateKey(date);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

export const timeOf = (ts: number) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/**
 * Logs a workout that already happened. It is created finished, so it counts for its date straight away
 * and opens in the editor to fill in exercises and sets.
 */
export async function logPastWorkout(opts: { date: string; time: string; durationMin: number; name?: string; template?: WorkoutTemplate }): Promise<Workout> {
  if (opts.date > toDateKey()) throw new Error('Pick today or an earlier day.');
  const startedAt = localTimestamp(opts.date, opts.time);
  const exercises: WorkoutExercise[] = (opts.template?.exercises ?? []).map((t) => ({
    exerciseId: t.exerciseId,
    name: t.name,
    sets: Array.from({ length: Math.max(1, t.sets) }, () => emptySet(undefined, true)),
  }));
  const w = newRecord({
    date: opts.date, startedAt, finishedAt: startedAt + Math.max(1, Math.round(opts.durationMin)) * 60_000,
    name: opts.name?.trim() || opts.template?.name || defaultName(startedAt), templateId: opts.template?.id, exercises,
  }) as Workout;
  await db.workouts.put(w);
  return w;
}

function defaultName(ts: number): string {
  const h = new Date(ts).getHours();
  return h < 12 ? 'Morning workout' : h < 17 ? 'Afternoon workout' : 'Evening workout';
}

/**
 * Edits to one workout run strictly one after another: inputs fire updates without awaiting, and
 * overlapping read-modify-write cycles would otherwise overwrite each other (lost sets when typing fast).
 */
const queues = new Map<string, Promise<unknown>>();

function mutate(id: string, fn: (w: Workout) => void): Promise<Workout> {
  const run = async () => {
    const w = await db.workouts.get(id);
    if (!w) throw new Error('Workout not found.');
    fn(w);
    w.updatedAt = Date.now();
    await db.workouts.put(w);
    return w;
  };
  const next = (queues.get(id) ?? Promise.resolve()).then(run, run);
  queues.set(id, next.catch(() => undefined));
  return next;
}

export const addExercise = (id: string, def: ExerciseDef, sets = 3) =>
  mutate(id, (w) => { w.exercises.push({ exerciseId: def.id, name: def.name, sets: Array.from({ length: sets }, () => emptySet(undefined, !!w.finishedAt)) }); });

export const removeExercise = (id: string, index: number) => mutate(id, (w) => { w.exercises.splice(index, 1); });

export const moveExercise = (id: string, index: number, dir: -1 | 1) =>
  mutate(id, (w) => {
    const j = index + dir;
    if (j < 0 || j >= w.exercises.length) return;
    [w.exercises[index], w.exercises[j]] = [w.exercises[j], w.exercises[index]];
  });

export const addSet = (id: string, exIndex: number) =>
  mutate(id, (w) => { const sets = w.exercises[exIndex].sets; sets.push(emptySet(sets[sets.length - 1], !!w.finishedAt)); });

export const removeSet = (id: string, exIndex: number, setIndex: number) => mutate(id, (w) => { w.exercises[exIndex].sets.splice(setIndex, 1); });

export const updateSet = (id: string, exIndex: number, setIndex: number, patch: Partial<WorkoutSet>) =>
  mutate(id, (w) => { Object.assign(w.exercises[exIndex].sets[setIndex], patch); });

export const updateWorkoutMeta = (id: string, patch: Partial<Pick<Workout, 'name' | 'note'>>) => mutate(id, (w) => { Object.assign(w, patch); });

/** Moves a finished workout to another day, start time or duration. */
export const updateWorkoutTiming = (id: string, patch: { date?: string; time?: string; durationMin?: number }) =>
  mutate(id, (w) => {
    const date = patch.date || w.date;
    if (date > toDateKey()) return;
    const duration = patch.durationMin !== undefined ? Math.max(1, Math.round(patch.durationMin)) * 60_000 : (w.finishedAt ?? w.startedAt) - w.startedAt;
    w.date = date;
    w.startedAt = localTimestamp(date, patch.time || timeOf(w.startedAt));
    if (w.finishedAt) w.finishedAt = w.startedAt + duration;
  });

/** After editing a finished workout: drops sets left blank and exercises without sets. */
export const tidyWorkout = (id: string) =>
  mutate(id, (w) => {
    w.exercises = w.exercises
      .map((ex) => ({ ...ex, sets: ex.sets.filter((s) => s.reps !== undefined || s.kg !== undefined || s.durationSec !== undefined).map((s) => ({ ...s, done: true })) }))
      .filter((ex) => ex.sets.length > 0);
  });

/** Finish: drops sets that were never completed and exercises left empty. */
export const finishWorkout = (id: string) =>
  mutate(id, (w) => {
    w.finishedAt = Date.now();
    w.exercises = w.exercises.map((ex) => ({ ...ex, sets: ex.sets.filter((s) => s.done) })).filter((ex) => ex.sets.length > 0);
  });

export async function deleteWorkout(id: string): Promise<void> {
  const now = Date.now();
  await db.workouts.update(id, { deletedAt: now, updatedAt: now });
}

/** Starts a fresh workout with the same exercises and set counts. */
export async function repeatWorkout(source: Workout): Promise<Workout> {
  return startWorkout({ name: source.name, template: { ...templateFromWorkout(source, source.name), id: source.templateId ?? '' } as WorkoutTemplate });
}

// ---- templates ----

export function templateFromWorkout(w: Workout, name: string): Omit<WorkoutTemplate, 'id' | 'updatedAt'> {
  return {
    name,
    exercises: w.exercises.map((ex) => {
      const reps = ex.sets.filter((s) => s.type === 'working' && s.reps).map((s) => s.reps!);
      return { exerciseId: ex.exerciseId, name: ex.name, sets: Math.max(1, ex.sets.filter((s) => s.type === 'working').length), repMin: reps.length ? Math.min(...reps) : undefined, repMax: reps.length ? Math.max(...reps) : undefined };
    }),
  };
}

export async function saveTemplate(w: Workout, name: string): Promise<WorkoutTemplate> {
  if (!name.trim()) throw new Error('Name the template.');
  const t = newRecord(templateFromWorkout(w, name.trim())) as WorkoutTemplate;
  await db.workoutTemplates.put(t);
  return t;
}

export async function deleteTemplate(id: string): Promise<void> {
  const now = Date.now();
  await db.workoutTemplates.update(id, { deletedAt: now, updatedAt: now });
}

export function useTemplates(): WorkoutTemplate[] | undefined {
  return useLiveQuery(async () => (await db.workoutTemplates.toArray()).filter(alive).sort((a, b) => a.name.localeCompare(b.name)), []);
}
