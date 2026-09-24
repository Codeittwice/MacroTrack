/** Shared data hooks (integrator-owned). */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { DEFAULT_SETTINGS, alive } from '@/db/repo';
import type { DateKey, MacroTargets, Profile, Settings, TargetSet } from '@/db/types';
import { fromDateKey } from '@/lib/utils/date';

export function useSettings(): Settings {
  return useLiveQuery(() => db.settings.get('settings'), []) ?? DEFAULT_SETTINGS;
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

export function useTargets(date: DateKey): MacroTargets | undefined {
  return useLiveQuery(async () => resolveTargets(await getTargetSetFor(date), date), [date]);
}
