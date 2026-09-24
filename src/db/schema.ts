import Dexie, { type EntityTable } from 'dexie';
import type {
  CheckIn, DayNote, LogEntry, Measurement, Profile, ProgressPhoto, Recipe, SavedMeal,
  Settings, StoredFood, TargetSet, WaterEntry, WeightEntry,
} from './types';

/** Integrator-owned. Add tables/indexes only by bumping the version. */
export class MacroDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  weights!: EntityTable<WeightEntry, 'id'>;
  measurements!: EntityTable<Measurement, 'id'>;
  foods!: EntityTable<StoredFood, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  savedMeals!: EntityTable<SavedMeal, 'id'>;
  logEntries!: EntityTable<LogEntry, 'id'>;
  targets!: EntityTable<TargetSet, 'id'>;
  checkins!: EntityTable<CheckIn, 'id'>;
  water!: EntityTable<WaterEntry, 'id'>;
  notes!: EntityTable<DayNote, 'id'>;
  photos!: EntityTable<ProgressPhoto, 'id'>;

  constructor(name = 'macrotrack') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      settings: 'id',
      weights: 'id, date, updatedAt',
      measurements: 'id, date, updatedAt',
      foods: 'id, name, barcode, source, lastUsedAt, updatedAt',
      recipes: 'id, name, updatedAt',
      savedMeals: 'id, name, updatedAt',
      logEntries: 'id, date, [date+meal], foodId, loggedAt, updatedAt',
      targets: 'id, effectiveFrom, updatedAt',
      checkins: 'id, date, updatedAt',
      water: 'id, date, updatedAt',
      notes: 'id, date, updatedAt',
      photos: 'id, date, updatedAt',
    });
  }
}

export const db = new MacroDB();
