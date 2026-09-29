/**
 * Non-pure helpers that read/write TargetSets for the Settings page (Profile + Targets sections
 * share this so both follow the same "update today's set in place" rule).
 */
import { db } from '@/db/schema';
import { alive, newRecord } from '@/db/repo';
import { getTargetSetFor } from '@/app/hooks';
import { ageOn, today } from '@/lib/utils/date';
import { computeTargets, targetsFromProfile } from '@/lib/nutrition';
import type { MacroTargets, Profile, TargetSet } from '@/db/types';

async function findTodaySet(): Promise<TargetSet | undefined> {
  const rows = (await db.targets.where('effectiveFrom').equals(today()).toArray()).filter(alive);
  return rows[0];
}

/**
 * Write a TargetSet effective today. If one already exists for today (multiple sets can share an
 * effectiveFrom date), update it in place instead of creating a second one — getTargetSetFor only
 * sorts by effectiveFrom, so two same-day sets would be ambiguous.
 */
export async function upsertTodayTargetSet(data: {
  base: MacroTargets;
  mode: 'coached' | 'manual';
  tdee: number;
  perWeekday?: TargetSet['perWeekday'];
}): Promise<void> {
  const existing = await findTodaySet();
  if (existing) {
    await db.targets.put({
      ...existing,
      base: data.base,
      mode: data.mode,
      tdee: data.tdee,
      perWeekday: data.perWeekday,
      updatedAt: Date.now(),
    });
  } else {
    await db.targets.add(
      newRecord({
        effectiveFrom: today(),
        base: data.base,
        perWeekday: data.perWeekday,
        mode: data.mode,
        tdee: data.tdee,
      }),
    );
  }
}

/** The tdee to keep using: the current coached expenditure if a TargetSet exists, else a formula fallback. */
export async function currentTdee(profile: Profile, weightKg: number, age: number): Promise<number> {
  const latest = await getTargetSetFor(today());
  if (latest) return latest.tdee;
  return targetsFromProfile(profile, weightKg, age).tdee;
}

export async function latestWeightKg(fallbackKg: number): Promise<number> {
  const rows = (await db.weights.orderBy('date').toArray()).filter(alive);
  return rows.length ? rows[rows.length - 1].kg : fallbackKg;
}

/** Recompute a coached target set from the profile, keeping the current tdee. Drops any weekday overrides. */
export async function recalcCoachedTargets(profile: Profile): Promise<void> {
  const age = ageOn(profile.birthDate);
  const weightKg = await latestWeightKg(profile.startWeightKg);
  const tdee = await currentTdee(profile, weightKg, age);
  const base = computeTargets({
    tdee,
    weightKg,
    goalRatePctPerWeek: profile.goalRatePctPerWeek,
    diet: profile.diet,
    sex: profile.sex,
  });
  await upsertTodayTargetSet({ base, mode: 'coached', tdee });
}
