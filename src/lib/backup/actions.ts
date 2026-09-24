import { db } from '@/db/schema';
import { DEFAULT_SETTINGS } from '@/db/repo';
import type { Table } from 'dexie';

const BACKUP_VERSION = 1;
const TABLES = ['profile', 'settings', 'weights', 'measurements', 'foods', 'recipes', 'savedMeals', 'logEntries', 'targets', 'checkins', 'water', 'notes'] as const;
type TableName = typeof TABLES[number];

export interface BackupFile {
  version: number;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
}

function isBackup(value: unknown): value is BackupFile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BackupFile>;
  return candidate.version === BACKUP_VERSION && !!candidate.tables && typeof candidate.tables === 'object' && TABLES.every((table) => Array.isArray(candidate.tables?.[table]));
}

/** Export all JSON-safe local tracker data. API keys and photo blobs stay on the device. */
export async function createBackup(): Promise<BackupFile> {
  const tables = {} as Record<TableName, unknown[]>;
  for (const name of TABLES) {
    const rows = await (db[name] as { toArray(): Promise<unknown[]> }).toArray();
    tables[name] = name === 'settings'
      ? rows.map((row) => ({ ...(row as object), apiKeys: {} }))
      : rows;
  }
  return { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables };
}

export function parseBackup(text: string): BackupFile {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!isBackup(parsed)) throw new Error('This is not a MacroTrack backup file.');
  return parsed;
}

/** Replace tracker data with a validated backup while retaining the current device's AI keys. */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  if (!isBackup(backup)) throw new Error('This is not a MacroTrack backup file.');
  const currentSettings = await db.settings.get('settings');
  const tables = TABLES.map((name) => db[name]) as unknown as Table[];
  await db.transaction('rw', tables, async () => {
    for (const name of TABLES) await (db[name] as { clear(): Promise<void> }).clear();
    for (const name of TABLES) {
      const rows = name === 'settings'
        ? backup.tables.settings.map((row) => ({ ...DEFAULT_SETTINGS, ...(row as object), apiKeys: currentSettings?.apiKeys ?? {} }))
        : backup.tables[name];
      if (rows.length) await (db[name] as unknown as { bulkPut(items: unknown[]): Promise<void> }).bulkPut(rows);
    }
  });
}

export function backupFileName(date = new Date()): string {
  return `macrotrack-backup-${date.toISOString().slice(0, 10)}.json`;
}
