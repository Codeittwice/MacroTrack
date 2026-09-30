/** Shared data hooks (integrator-owned). */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { DEFAULT_SETTINGS, alive, withDefaults } from '@/db/repo';
import type { DateKey, MacroTargets, Profile, Settings, TargetSet } from '@/db/types';
import { fromDateKey } from '@/lib/utils/date';
import { exerciseBonusKcal } from '@/lib/training/burn';

export function useSettings(): Settings {
  const stored = useLiveQuery(() => db.settings.get('settings'), []);
  return withDefaults(stored);
}

/** undefined while loading, null when not onboarded. */
export function useProfile(): Profile | null | undefined {
  return useLiveQuery(async () => (await db.profile.toCollection().first()) ?? null, []);
}

/** Target set in effect on a date (latest effectiveFrom <= date). */
export async function getTargetSetFor(date: DateKey): Promise<TargetSet | undefined> {
  const sets = (await db.targets.where('effectiveFrom').belowOrEqual(date).toArray())
    .filter(alive)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || a.updatedAt - b.updatedAt);
  return sets[sets.length - 1];
}

export function resolveTargets(set: TargetSet | undefined, date: DateKey): MacroTargets | undefined {
  if (!set) return undefined;
  const wd = fromDateKey(date).getDay();
  return set.perWeekday?.[wd] ?? set.base;
}

/** Targets for a date, including workout calories when the exercise-calories setting is on (as carbs). */
export function useTargets(date: DateKey): MacroTargets | undefined {
  return useLiveQuery(async () => {
    const base = resolveTargets(await getTargetSetFor(date), date);
    if (!base) return undefined;
    const settings = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
    const bonus = await exerciseBonusKcal(date, settings.exerciseCalories ?? 'off');
    return bonus > 0 ? { ...base, kcal: base.kcal + bonus, carbs: base.carbs + Math.round(bonus / 4), exerciseKcal: bonus } : base;
  }, [date]);
}
