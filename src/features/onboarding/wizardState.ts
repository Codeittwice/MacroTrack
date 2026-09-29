import type { ActivityLevel, DietPreference, GoalType, Sex } from '@/db/types';

export interface WizardData {
  sex?: Sex;
  birthDate?: string; // DateKey
  heightCm?: number;
  weightKg?: number;
  bodyFatPct?: number;
  activity?: ActivityLevel;
  goal?: GoalType;
  goalWeightKg?: number;
  /** unsigned %BW per week, sign applied based on goal */
  goalRatePct?: number;
  diet?: DietPreference;
  checkInWeekday?: number;
}

export const INITIAL_WIZARD: WizardData = {
  checkInWeekday: 1,
  goal: 'lose',
  goalRatePct: 0.5,
};

export function cmToFtIn(cm: number): string {
  const totalInches = cm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inch = Math.round(totalInches - ft * 12);
  if (inch === 12) return `${ft + 1} ft 0 in`;
  return `${ft} ft ${inch} in`;
}

/** Signed %BW/week: negative for lose, 0 for maintain, positive for gain. */
export function signedRate(goal: GoalType | undefined, ratePct: number | undefined): number {
  if (!goal || goal === 'maintain') return 0;
  const r = ratePct ?? 0;
  return goal === 'lose' ? -Math.abs(r) : Math.abs(r);
}
