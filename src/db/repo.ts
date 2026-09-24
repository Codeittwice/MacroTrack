import { db } from './schema';
import type { Settings, Syncable } from './types';
import { uuid } from '@/lib/utils/id';

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  theme: 'dark',
  accent: 'green',
  weightUnit: 'kg',
  energyUnit: 'kcal',
  aiProvider: 'claude',
  apiKeys: {},
  mealNames: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'],
  waterGoalMl: 2500,
  syncEnabled: false,
  updatedAt: 0,
};

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const cur = await getSettings();
  await db.settings.put({ ...cur, ...patch, id: 'settings', updatedAt: Date.now() });
}

/** Stamp id/updatedAt on a new record. */
export function newRecord<T extends object>(data: T): T & Syncable {
  return { ...data, id: uuid(), updatedAt: Date.now() };
}

/** Soft delete filter (tombstones are kept for sync). Every list query must apply it. */
export const alive = <T extends { deletedAt?: number }>(r: T) => !r.deletedAt;

export async function softDelete(table: { update(id: string, c: object): Promise<number> }, id: string) {
  const now = Date.now();
  await table.update(id, { deletedAt: now, updatedAt: now });
}
