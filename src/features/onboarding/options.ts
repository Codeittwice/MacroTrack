import type { ActivityLevel, DietPreference, GoalType } from '@/db/types';

export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Desk job, little to no exercise' },
  { value: 'light', label: 'Lightly active', desc: 'Light exercise 1-3 days/week' },
  { value: 'moderate', label: 'Moderately active', desc: 'Moderate exercise 3-5 days/week' },
  { value: 'very', label: 'Very active', desc: 'Hard exercise 6-7 days/week' },
  { value: 'extra', label: 'Extra active', desc: 'Physical job or training twice a day' },
];

export const DIET_OPTIONS: { value: DietPreference; label: string; desc: string }[] = [
  { value: 'balanced', label: 'Balanced', desc: 'An even mix of protein, carbs and fat' },
  { value: 'low-fat', label: 'Low-fat', desc: 'Lower fat, higher carbs' },
  { value: 'low-carb', label: 'Low-carb', desc: 'Lower carbs, higher protein and fat' },
  { value: 'keto', label: 'Keto', desc: 'Very low carb, high fat' },
  { value: 'high-protein', label: 'High-protein', desc: 'Extra protein to support training' },
];

export const GOAL_OPTIONS: { value: GoalType; label: string }[] = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain weight' },
];

export const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const LOSE_RATE_PRESETS = [0.25, 0.5, 0.75, 1.0];
export const GAIN_RATE_PRESETS = [0.1, 0.25, 0.5];
