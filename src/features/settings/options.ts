/**
 * Feature-local option lists for the Settings page. Deliberately not imported from
 * src/features/onboarding (owned by a parallel workstream) — kept small and duplicated here.
 */
import type { ActivityLevel, DietPreference, GoalType } from '@/db/types';

export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'very', label: 'Very active' },
  { value: 'extra', label: 'Extra active' },
];

export const DIET_OPTIONS: { value: DietPreference; label: string }[] = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'low-fat', label: 'Low-fat' },
  { value: 'low-carb', label: 'Low-carb' },
  { value: 'keto', label: 'Keto' },
  { value: 'high-protein', label: 'High-protein' },
];

export const GOAL_OPTIONS: { value: GoalType; label: string }[] = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain weight' },
];

export const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];
