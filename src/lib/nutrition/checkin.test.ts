import { describe, expect, it } from 'vitest';
import type { DateKey, Profile } from '@/db/types';
import { proposeCheckIn } from './checkin';
import { simulate } from './fixtures/simulate';

const START_DATE: DateKey = '2024-01-01';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'profile-1',
    updatedAt: Date.now(),
    sex: 'male',
    birthDate: '1990-01-01',
    heightCm: 180,
    startWeightKg: 90,
    activity: 'sedentary',
    goal: 'lose',
    goalRatePctPerWeek: -0.5,
    diet: 'balanced',
    checkInWeekday: 1,
    onboardedAt: Date.now(),
    ...overrides,
  };
}

describe('proposeCheckIn', () => {
  it('proposes an expenditure near the truth on a simulated cut, with a negative weekly rate', () => {
    const days = 56;
    const sim = simulate({
      trueTdee: 2600,
      startKg: 90,
      days,
      dailyIntake: 2100,
      intakeNoiseSd: 150,
      scaleNoiseKg: 0.5,
      seed: 3,
      startDate: START_DATE,
    });
    const lastDate = sim.weights[sim.weights.length - 1].date;
    const profile = makeProfile();

    const result = proposeCheckIn({
      profile,
      weights: sim.weights,
      intake: sim.intake,
      currentWeightKg: sim.weights[sim.weights.length - 1].kg,
      age: 34,
      date: lastDate,
    });

    expect(Math.abs(result.expenditure - 2600)).toBeLessThanOrEqual(150);
    expect(result.weeklyRateKg).toBeLessThan(0);

    const trueLastKg = sim.trueWeights[sim.trueWeights.length - 1].kg;
    expect(Math.abs(result.trendWeightKg - trueLastKg)).toBeLessThan(2);

    // deficit target: kcal ~= expenditure + goalRate deficit, or the sex-based floor.
    const kgPerWeek = (profile.goalRatePctPerWeek / 100) * result.trendWeightKg;
    const expectedKcal = Math.max(1500, Math.round(result.expenditure + (kgPerWeek * 7700) / 7));
    expect(Math.abs(result.proposed.kcal - expectedKcal)).toBeLessThanOrEqual(1);
    expect(result.proposed.protein).toBeGreaterThan(0);
  });

  it('filters weights/intake to the requested date and falls back to currentWeightKg with no weights', () => {
    const profile = makeProfile();
    const result = proposeCheckIn({
      profile,
      weights: [],
      intake: [],
      currentWeightKg: 85,
      age: 30,
      date: '2024-06-01',
    });
    expect(result.trendWeightKg).toBe(85);
    expect(result.weeklyRateKg).toBe(0);
    expect(result.confidence).toBe('low');
    expect(result.proposed.protein).toBeGreaterThan(0);
  });
});
