import { ageOn } from '@/lib/utils/date';
import type { WizardData } from './wizardState';

export function stepValid(step: number, w: WizardData): boolean {
  switch (step) {
    case 0: // welcome
      return true;
    case 1: { // sex, birth date, height
      if (!w.sex || !w.birthDate || w.heightCm === undefined) return false;
      if (w.heightCm < 120 || w.heightCm > 230) return false;
      const age = ageOn(w.birthDate);
      if (age < 14 || age > 100) return false;
      return true;
    }
    case 2: { // weight, body fat
      if (w.weightKg === undefined) return false;
      if (w.weightKg < 30 || w.weightKg > 300) return false;
      if (w.bodyFatPct !== undefined && (w.bodyFatPct < 3 || w.bodyFatPct > 60)) return false;
      return true;
    }
    case 3: // activity
      return !!w.activity;
    case 4: { // goal
      if (!w.goal) return false;
      if (w.goal === 'maintain') return true;
      if (w.goalWeightKg === undefined || w.weightKg === undefined) return false;
      if (w.goal === 'lose' && !(w.goalWeightKg < w.weightKg)) return false;
      if (w.goal === 'gain' && !(w.goalWeightKg > w.weightKg)) return false;
      if (w.goalRatePct === undefined || w.goalRatePct <= 0) return false;
      return true;
    }
    case 5: // diet
      return !!w.diet;
    case 6: // check-in weekday
      return w.checkInWeekday !== undefined;
    case 7: // summary
      return true;
    default:
      return false;
  }
}

export function heightErrorMsg(heightCm: number | undefined): string | undefined {
  if (heightCm === undefined) return undefined;
  if (heightCm < 120 || heightCm > 230) return 'Height must be between 120 and 230 cm';
  return undefined;
}

export function ageErrorMsg(birthDate: string | undefined): string | undefined {
  if (!birthDate) return undefined;
  const age = ageOn(birthDate);
  if (age < 14 || age > 100) return 'Age must be between 14 and 100';
  return undefined;
}

export function weightErrorMsg(weightKg: number | undefined): string | undefined {
  if (weightKg === undefined) return undefined;
  if (weightKg < 30 || weightKg > 300) return 'Weight must be between 30 and 300 kg';
  return undefined;
}

export function bodyFatErrorMsg(bodyFatPct: number | undefined): string | undefined {
  if (bodyFatPct === undefined) return undefined;
  if (bodyFatPct < 3 || bodyFatPct > 60) return 'Body fat must be between 3% and 60%';
  return undefined;
}

export function goalWeightErrorMsg(goal: WizardData['goal'], goalWeightKg: number | undefined, weightKg: number | undefined): string | undefined {
  if (!goal || goal === 'maintain' || goalWeightKg === undefined || weightKg === undefined) return undefined;
  if (goal === 'lose' && !(goalWeightKg < weightKg)) return 'Goal weight must be below your current weight';
  if (goal === 'gain' && !(goalWeightKg > weightKg)) return 'Goal weight must be above your current weight';
  return undefined;
}
