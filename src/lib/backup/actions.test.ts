import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { DEFAULT_SETTINGS } from '@/db/repo';
import { createBackup, parseBackup, restoreBackup } from './actions';

beforeEach(async () => {
  await Promise.all(['profile', 'settings', 'weights', 'measurements', 'foods', 'recipes', 'savedMeals', 'logEntries', 'targets', 'checkins', 'water', 'notes'].map((name) => (db[name as keyof typeof db] as { clear(): Promise<void> }).clear()));
});

describe('backup', () => {
  it('exports tracker data without API keys and restores it', async () => {
    await db.settings.put({ ...DEFAULT_SETTINGS, apiKeys: { claude: 'private-key' }, updatedAt: 1 });
    await db.water.put({ id: 'water', date: '2026-09-24', ml: 750, updatedAt: 1 });
    const backup = await createBackup();
    expect(backup.tables.settings[0]).toMatchObject({ apiKeys: {} });
    await db.water.clear();
    await restoreBackup(backup);
    expect(await db.water.get('water')).toMatchObject({ ml: 750 });
    expect((await db.settings.get('settings'))?.apiKeys).toEqual({ claude: 'private-key' });
  });

  it('rejects malformed backup files', () => {
    expect(() => parseBackup('{')).toThrow('valid JSON');
    expect(() => parseBackup(JSON.stringify({ version: 2, tables: {} }))).toThrow('MacroTrack');
  });
});
