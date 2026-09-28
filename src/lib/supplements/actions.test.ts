import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { getDayEntries } from '@/lib/log/queries';
import { adherence, createSupplement, deleteSupplement, logsForDate, toggleTaken } from './actions';

beforeEach(async () => {
  await Promise.all([db.supplements.clear(), db.supplementLogs.clear(), db.logEntries.clear(), db.settings.clear()]);
});

const creatine = { name: 'Creatine', dose: 5, unit: 'g', timesPerDay: 1, active: true };
const whey = { name: 'Whey', dose: 30, unit: 'g', timesPerDay: 1, active: true, nutrients: { kcal: 120, protein: 24, carbs: 3, fat: 1.5 } };

describe('supplements', () => {
  it('validates input', async () => {
    await expect(createSupplement({ ...creatine, name: ' ' })).rejects.toThrow('name');
    await expect(createSupplement({ ...creatine, dose: 0 })).rejects.toThrow('dose');
    await expect(createSupplement({ ...creatine, timesPerDay: 7 })).rejects.toThrow('1 to 6');
  });

  it('ticks and unticks doses', async () => {
    const s = await createSupplement(creatine);
    expect(await toggleTaken('2026-09-28', s)).toBe(true);
    expect(await logsForDate('2026-09-28')).toHaveLength(1);
    expect(await toggleTaken('2026-09-28', s)).toBe(false);
    expect(await logsForDate('2026-09-28')).toHaveLength(0);
  });

  it('adds supplements with calories to the food log and removes them when unticked', async () => {
    const s = await createSupplement(whey);
    await toggleTaken('2026-09-28', s);
    let entries = await getDayEntries('2026-09-28');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ name: 'Whey (30 g)', meal: 3 });
    expect(entries[0].nutrients).toMatchObject({ kcal: 120, protein: 24 });
    await toggleTaken('2026-09-28', s);
    entries = await getDayEntries('2026-09-28');
    expect(entries).toHaveLength(0);
  });

  it('computes adherence and streak', async () => {
    const s = await createSupplement(creatine);
    for (const d of ['2026-09-25', '2026-09-26', '2026-09-27']) await toggleTaken(d, s);
    const a = await adherence(s, '2026-09-28', 10);
    expect(a.streak).toBe(3); // today not yet taken, so the streak runs through yesterday
    expect(a.pct).toBe(30);
    await toggleTaken('2026-09-28', s);
    expect((await adherence(s, '2026-09-28', 10)).streak).toBe(4);
    await deleteSupplement(s.id);
  });
});
