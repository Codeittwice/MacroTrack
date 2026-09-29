import { db } from '@/db/schema';
import { alive } from '@/db/repo';
import type { DateKey, Settings } from '@/db/types';
import { customToDef } from './actions';
import { builtInExercise } from './exercises';
import { estimatedBurnKcal } from './strength';

export const EXERCISE_FACTOR: Record<Settings['exerciseCalories'], number> = { off: 0, half: 0.5, full: 1 };

/**
 * Calories to add to a day's target for its finished workouts, per the exercise-calories setting.
 * Uses the latest logged body weight. Returns 0 when the setting is off.
 */
export async function exerciseBonusKcal(date: DateKey, mode: Settings['exerciseCalories']): Promise<number> {
  const factor = EXERCISE_FACTOR[mode] ?? 0;
  if (!factor) return 0;
  const workouts = (await db.workouts.where('date').equals(date).toArray()).filter((w) => alive(w) && w.finishedAt);
  if (!workouts.length) return 0;
  const lastWeight = (await db.weights.orderBy('date').reverse().toArray()).find(alive)?.kg ?? (await db.profile.toCollection().first())?.startWeightKg ?? 0;
  const custom = new Map((await db.exercises.toArray()).filter(alive).map((c) => [c.id, customToDef(c)]));
  const lookup = (id: string) => builtInExercise(id) ?? custom.get(id);
  return Math.round(factor * workouts.reduce((sum, w) => sum + estimatedBurnKcal(w, lastWeight, lookup), 0));
}
