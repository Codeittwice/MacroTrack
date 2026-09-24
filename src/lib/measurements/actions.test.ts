import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { deleteMeasurement, getMeasurements, saveMeasurement } from './actions';

beforeEach(async () => db.measurements.clear());

describe('measurements', () => {
  it('upserts one daily record and keeps values valid', async () => {
    const first = await saveMeasurement('2026-09-24', { waist: 84, chest: 100 });
    const second = await saveMeasurement('2026-09-24', { waist: 83 });
    expect(second.id).toBe(first.id);
    expect(await getMeasurements()).toMatchObject([{ date: '2026-09-24', values: { waist: 83 } }]);
    await expect(saveMeasurement('2026-09-25', { waist: -1 })).rejects.toThrow();
  });

  it('soft-deletes a record from the active history', async () => {
    const entry = await saveMeasurement('2026-09-24', { hips: 98 });
    await deleteMeasurement(entry.id);
    expect(await getMeasurements()).toEqual([]);
  });
});
