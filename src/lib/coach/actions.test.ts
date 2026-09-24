import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import type { Profile } from '@/db/types';
import { newRecord } from '@/db/repo';
import { prepareCheckIn, saveCheckIn } from './actions';

const PROFILE: Profile = {
  id: 'profile', updatedAt: Date.now(), sex: 'female', birthDate: '1990-01-01', heightCm: 170, startWeightKg: 80,
  activity: 'moderate', goal: 'lose', goalRatePctPerWeek: -0.5, diet: 'balanced', checkInWeekday: 1, onboardedAt: Date.now(),
};

beforeEach(async () => {
  await Promise.all([db.weights.clear(), db.logEntries.clear(), db.notes.clear(), db.targets.clear(), db.checkins.clear()]);
});

describe('Coach check-ins', () => {
  it('builds a proposal from local history and accepts it into today targets', async () => {
    await db.weights.bulkAdd([newRecord({ date: '2026-09-01', kg: 80 }), newRecord({ date: '2026-09-24', kg: 79 })]);
    const proposal = await prepareCheckIn(PROFILE, '2026-09-24');
    expect(proposal.proposed.kcal).toBeGreaterThan(0);

    const checkIn = await saveCheckIn('2026-09-24', proposal, true);
    expect(checkIn.accepted).toBe(true);
    expect((await db.targets.where('effectiveFrom').equals('2026-09-24').first())?.tdee).toBe(proposal.expenditure);
  });

  it('records a declined proposal without changing targets and updates same-day review', async () => {
    const proposal = await prepareCheckIn(PROFILE, '2026-09-24');
    const first = await saveCheckIn('2026-09-24', proposal, false);
    const second = await saveCheckIn('2026-09-24', { ...proposal, expenditure: proposal.expenditure + 20 }, false);
    expect(second.id).toBe(first.id);
    expect((await db.checkins.where('date').equals('2026-09-24').toArray()).filter((item) => !item.deletedAt)).toHaveLength(1);
    expect(await db.targets.where('effectiveFrom').equals('2026-09-24').first()).toBeUndefined();
  });
});
