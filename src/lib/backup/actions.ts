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

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Per-table row checks: enough to keep a corrupted or hand-edited file from breaking the app. */
const ROW_OK: Partial<Record<TableName, (r: Record<string, unknown>) => boolean>> = {
  weights: (r) => isDate(r.date) && finite(r.kg),
  logEntries: (r) => isDate(r.date) && finite(r.meal) && isObj(r.nutrients) && finite((r.nutrients as Record<string, unknown>).kcal),
  targets: (r) => isDate(r.effectiveFrom) && isObj(r.base) && finite((r.base as Record<string, unknown>).kcal),
  water: (r) => isDate(r.date) && finite(r.ml),
  measurements: (r) => isDate(r.date) && isObj(r.values),
  checkins: (r) => isDate(r.date),
  notes: (r) => isDate(r.date),
};

function isBackup(value: unknown): value is BackupFile {
  if (!isObj(value)) return false;
  const candidate = value as Partial<BackupFile>;
  if (candidate.version !== BACKUP_VERSION || !isObj(candidate.tables)) return false;
  return TABLES.every((table) => {
    const rows = candidate.tables?.[table];
    if (!Array.isArray(rows)) return false;
    const check = ROW_OK[table];
    return rows.every((row) => isObj(row) && typeof row.id === 'string' && (!check || check(row)));
  });
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
