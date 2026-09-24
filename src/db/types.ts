/**
 * Shared domain types. Every wave imports from here; changes go through the wave integrator.
 * Conventions: weights in kg, energy in kcal, nutrient amounts in grams (sodium in mg),
 * dates as local 'YYYY-MM-DD' strings (DateKey), timestamps as epoch ms.
 */

export type DateKey = string; // 'YYYY-MM-DD'

/** Base fields on every stored record (sync-ready). */
export interface Syncable {
  id: string;
  updatedAt: number;
  deletedAt?: number;
}

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  satFat?: number;
  /** mg */
  sodium?: number;
  /** g */
  salt?: number;
  alcohol?: number;
}

export type FoodSourceId = 'nevo' | 'off' | 'ah' | 'user' | 'recipe' | 'ai' | 'quick';

export interface Serving {
  label: string; // '1 broodje', 'portion', '100 g'
  grams: number;
}

/** Common food shape returned by every FoodSource. Nutrients are per 100 g (or 100 ml). */
export interface FoodItem {
  id: string; // source-scoped, e.g. 'nevo:1234', 'off:8710400...', 'user:<uuid>'
  source: FoodSourceId;
  name: string;
  nameEn?: string;
  brand?: string;
  barcode?: string;
  per100: Nutrients;
  servings: Serving[];
  unit?: 'g' | 'ml';
}

export interface FoodSource {
  id: FoodSourceId;
  search(query: string, limit?: number): Promise<FoodItem[]>;
  getById?(id: string): Promise<FoodItem | undefined>;
  getByBarcode?(barcode: string): Promise<FoodItem | undefined>;
}

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra';
export type GoalType = 'lose' | 'maintain' | 'gain';
export type DietPreference = 'balanced' | 'low-fat' | 'low-carb' | 'keto' | 'high-protein';

export interface Profile extends Syncable {
  sex: Sex;
  birthDate: DateKey;
  heightCm: number;
  startWeightKg: number;
  bodyFatPct?: number;
  activity: ActivityLevel;
  goal: GoalType;
  /** Signed %BW per week; negative = loss. e.g. -0.5 */
  goalRatePctPerWeek: number;
  goalWeightKg?: number;
  diet: DietPreference;
  /** 0 = Sunday … 6 = Saturday */
  checkInWeekday: number;
  onboardedAt: number;
}

export type ThemeMode = 'dark' | 'light' | 'system';
export type Accent = 'green' | 'ocean' | 'sunset';
export type AiProviderId = 'claude' | 'openai' | 'gemini';

export interface Settings {
  id: 'settings';
  theme: ThemeMode;
  accent: Accent;
  weightUnit: 'kg' | 'lb';
  energyUnit: 'kcal' | 'kJ';
  aiProvider: AiProviderId;
  apiKeys: Partial<Record<AiProviderId, string>>;
  mealNames: string[]; // default ['Breakfast','Lunch','Dinner','Snacks']
  waterGoalMl: number;
  syncEnabled: boolean;
  updatedAt: number;
}

export interface WeightEntry extends Syncable {
  date: DateKey;
  kg: number;
  bodyFatPct?: number;
  note?: string;
  /** epoch ms of measurement (multiple per day are averaged) */
  time?: number;
}

export interface Measurement extends Syncable {
  date: DateKey;
  /** e.g. { waist: 84, chest: 102, hips: 98 } in cm */
  values: Record<string, number>;
}

export interface Recipe extends Syncable {
  name: string;
  ingredients: { food: FoodItem; grams: number }[];
  /** total cooked weight; per100 is derived from total nutrients / yieldGrams */
  yieldGrams: number;
  servings: number;
  favorite?: boolean;
}

export interface SavedMeal extends Syncable {
  name: string;
  items: { food: FoodItem; grams: number }[];
}

export interface LogEntry extends Syncable {
  date: DateKey;
  /** index into Settings.mealNames */
  meal: number;
  /** FoodItem.id (may no longer resolve) */
  foodId: string;
  name: string;
  brand?: string;
  source: FoodSourceId;
  grams: number;
  servingLabel?: string;
  /** Snapshot of totals for this entry (NOT per 100 g) so history never changes. */
  nutrients: Nutrients;
  /** Snapshot of per-100 values, used when editing grams. */
  per100?: Nutrients;
  loggedAt: number;
}

/** Custom / cached foods (user-created, OFF cache, AI-saved). `id` equals the FoodItem id. */
export interface StoredFood extends Syncable, Omit<FoodItem, 'id'> {
  favorite?: boolean;
  useCount?: number;
  lastUsedAt?: number;
}

export interface MacroTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface TargetSet extends Syncable {
  effectiveFrom: DateKey;
  base: MacroTargets;
  /** optional per weekday overrides (0 = Sunday) */
  perWeekday?: Partial<Record<number, MacroTargets>>;
  mode: 'coached' | 'manual';
  tdee: number;
}

export interface CheckIn extends Syncable {
  date: DateKey;
  expenditure: number;
  trendWeightKg: number;
  weeklyRateKg: number;
  proposed: MacroTargets;
  accepted: boolean;
}

export interface WaterEntry extends Syncable {
  date: DateKey;
  ml: number;
}

export interface DayNote extends Syncable {
  date: DateKey;
  text: string;
  /** user flag: this day's food log is incomplete, exclude from expenditure */
  incomplete?: boolean;
}

export interface ProgressPhoto extends Syncable {
  date: DateKey;
  blob: Blob;
  pose?: 'front' | 'side' | 'back';
}
