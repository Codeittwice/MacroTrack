import { db } from '@/db/schema';
import { alive, newRecord } from '@/db/repo';
import type { CheckIn, DateKey, Profile, TargetSet } from '@/db/types';
import { getTargetSetFor } from '@/app/hooks';
import { getDailyIntake } from '@/lib/log/queries';
import { proposeCheckIn, type ProposeCheckInResult } from '@/lib/nutrition';
import { ageOn, addDays, today } from '@/lib/utils/date';

export async function prepareCheckIn(profile: Profile, date: DateKey = today()): Promise<ProposeCheckInResult> {
  const [weights, intake, previous] = await Promise.all([
    db.weights.orderBy('date').toArray(),
    getDailyIntake(addDays(date, -89), date),
    getTargetSetFor(date),
  ]);
  const validWeights = weights.filter((weight) => alive(weight) && weight.date <= date);
  const currentWeightKg = validWeights.at(-1)?.kg ?? profile.startWeightKg;
  return proposeCheckIn({
    profile,
    weights: validWeights,
    intake,
    previousExpenditure: previous?.tdee,
    currentWeightKg,
    age: ageOn(profile.birthDate, date),
    date,
  });
}

async function writeTarget(date: DateKey, proposal: ProposeCheckInResult): Promise<void> {
  const existing = (await db.targets.where('effectiveFrom').equals(date).toArray()).find(alive);
  const target: TargetSet = existing
    ? { ...existing, base: proposal.proposed, tdee: proposal.expenditure, mode: 'coached', perWeekday: undefined, updatedAt: Date.now() }
    : newRecord({ effectiveFrom: date, base: proposal.proposed, tdee: proposal.expenditure, mode: 'coached' });
  await db.targets.put(target);
}

/** Record a reviewed weekly check-in; accepted proposals become today's coached target set. */
export async function saveCheckIn(date: DateKey, proposal: ProposeCheckInResult, accepted: boolean): Promise<CheckIn> {
  return db.transaction('rw', db.checkins, db.targets, async () => {
    const existing = (await db.checkins.where('date').equals(date).toArray()).find(alive);
    const checkIn: CheckIn = existing
      ? { ...existing, date, expenditure: proposal.expenditure, trendWeightKg: proposal.trendWeightKg, weeklyRateKg: proposal.weeklyRateKg, proposed: proposal.proposed, accepted, updatedAt: Date.now() }
      : newRecord({ date, expenditure: proposal.expenditure, trendWeightKg: proposal.trendWeightKg, weeklyRateKg: proposal.weeklyRateKg, proposed: proposal.proposed, accepted });
    await db.checkins.put(checkIn);
    if (accepted) await writeTarget(date, proposal);
    return checkIn;
  });
}
