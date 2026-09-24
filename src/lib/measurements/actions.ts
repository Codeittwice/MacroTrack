import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { alive, newRecord, softDelete } from '@/db/repo';
import type { DateKey, Measurement } from '@/db/types';

export const MEASUREMENT_FIELDS = ['waist', 'chest', 'hips'] as const;
export type MeasurementField = typeof MEASUREMENT_FIELDS[number];

function cleanValues(values: Record<string, number>): Record<string, number> {
  const cleaned = Object.entries(values).filter(([, value]) => Number.isFinite(value) && value > 0 && value <= 300);
  if (!cleaned.length) throw new Error('at least one measurement between 0 and 300 cm is required');
  return Object.fromEntries(cleaned);
}

export async function getMeasurements(): Promise<Measurement[]> {
  return (await db.measurements.orderBy('date').reverse().toArray()).filter(alive);
}

export function useMeasurements(): Measurement[] | undefined {
  return useLiveQuery(getMeasurements, []);
}

/** Upsert a single daily measurement record so trend history has one unambiguous point per date. */
export async function saveMeasurement(date: DateKey, values: Record<string, number>): Promise<Measurement> {
  const existing = (await db.measurements.where('date').equals(date).toArray()).find(alive);
  const measurement: Measurement = existing ? { ...existing, values: cleanValues(values), updatedAt: Date.now() } : newRecord({ date, values: cleanValues(values) });
  await db.measurements.put(measurement);
  return measurement;
}

export async function deleteMeasurement(id: string): Promise<void> {
  await softDelete(db.measurements, id);
}
