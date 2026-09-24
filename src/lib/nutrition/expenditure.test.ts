import { describe, expect, it } from 'vitest';
import type { DateKey } from '@/db/types';
import { estimateExpenditure, expenditureSeries } from './expenditure';
import { simulate } from './fixtures/simulate';
import { trendWeight } from './trend';

const SEEDS = [1, 2, 3, 4, 5];
const START_DATE: DateKey = '2024-01-01';

function run(opts: {
  trueTdee: number;
  intake: number;
  days: number;
  seed: number;
  prior: number;
  logProbability?: number;
  windowDays?: number;
}) {
  const sim = simulate({
    trueTdee: opts.trueTdee,
    startKg: 90,
    days: opts.days,
    dailyIntake: opts.intake,
    intakeNoiseSd: 150,
    scaleNoiseKg: 0.5,
    logProbability: opts.logProbability ?? 1,
    seed: opts.seed,
    startDate: START_DATE,
  });
  const trend = trendWeight(sim.weights);
  const series = expenditureSeries(sim.intake, trend, opts.prior, { windowDays: opts.windowDays });
  const direct = estimateExpenditure({ intake: sim.intake, trend, prior: opts.prior, windowDays: opts.windowDays });
  return { sim, trend, series, direct };
}

describe('estimateExpenditure / expenditureSeries accuracy (simulated)', () => {
  it('cutting: recovers trueTdee ~2600 within +/-75 kcal across seeds', () => {
    for (const seed of SEEDS) {
      const { series } = run({ trueTdee: 2600, intake: 2100, days: 56, seed, prior: 2300 });
      const last = series[series.length - 1].value;
      expect(Math.abs(last - 2600), `seed ${seed}: got ${last}`).toBeLessThanOrEqual(75);
    }
  });

  it('bulking: recovers trueTdee ~2400 within +/-75 kcal across seeds', () => {
    for (const seed of SEEDS) {
      const { series } = run({ trueTdee: 2400, intake: 2800, days: 56, seed, prior: 2600 });
      const last = series[series.length - 1].value;
      expect(Math.abs(last - 2400), `seed ${seed}: got ${last}`).toBeLessThanOrEqual(75);
    }
  });

  it('maintenance: recovers trueTdee ~2500 within +/-75 kcal across seeds', () => {
    for (const seed of SEEDS) {
      const { series } = run({ trueTdee: 2500, intake: 2500, days: 56, seed, prior: 2700 });
      const last = series[series.length - 1].value;
      expect(Math.abs(last - 2500), `seed ${seed}: got ${last}`).toBeLessThanOrEqual(75);
    }
  });

  it('sparse logging (60%): recovers trueTdee ~2600 within +/-120 kcal across seeds', () => {
    for (const seed of SEEDS) {
      const { series } = run({ trueTdee: 2600, intake: 2100, days: 56, seed, prior: 2300, logProbability: 0.6 });
      const last = series[series.length - 1].value;
      expect(Math.abs(last - 2600), `seed ${seed}: got ${last}`).toBeLessThanOrEqual(120);
    }
  });
});

describe('estimateExpenditure edge cases', () => {
  it('returns the prior exactly with fewer than 10 logged days, confidence low', () => {
    const sim = simulate({
      trueTdee: 2600,
      startKg: 90,
      days: 15,
      dailyIntake: 2100,
      logProbability: 5 / 15, // ~5 logged days out of 15
      seed: 42,
      startDate: START_DATE,
    });
    const trend = trendWeight(sim.weights);
    expect(sim.intake.length).toBeLessThan(10);
    const result = estimateExpenditure({ intake: sim.intake, trend, prior: 2450 });
    expect(result.expenditure).toBe(2450);
    expect(result.confidence).toBe('low');
    expect(result.daysUsed).toBeLessThan(10);
  });

  it('confidence graduates from low to medium to high with more logged days', () => {
    const sim = simulate({
      trueTdee: 2600,
      startKg: 90,
      days: 40,
      dailyIntake: 2100,
      seed: 7,
      startDate: START_DATE,
    });
    const trend = trendWeight(sim.weights);

    const few = estimateExpenditure({ intake: sim.intake.slice(0, 8), trend: trend.slice(0, 8), prior: 2450 });
    expect(few.confidence).toBe('low');

    const medium = estimateExpenditure({ intake: sim.intake.slice(0, 12), trend: trend.slice(0, 12), prior: 2450 });
    expect(medium.confidence).toBe('medium');

    const many = estimateExpenditure({ intake: sim.intake, trend, prior: 2450 });
    expect(many.confidence).toBe('high');
  });

  it('caps the change to <= 100 kcal per 7 days relative to previous', () => {
    const sim = simulate({
      trueTdee: 2600,
      startKg: 90,
      days: 56,
      dailyIntake: 2100,
      seed: 3,
      startDate: START_DATE,
    });
    const trend = trendWeight(sim.weights);
    const result = estimateExpenditure({
      intake: sim.intake,
      trend,
      prior: 2450,
      previous: 2000,
      daysSincePrevious: 7,
    });
    expect(result.expenditure).toBeLessThanOrEqual(2100);
  });

  it('shrinks sparse eligible data toward the prior and trusts more data progressively', () => {
    const makeInput = (days: number) => {
      const trend = Array.from({ length: days }, (_, index) => ({
        date: `2024-01-${String(index + 1).padStart(2, '0')}`,
        value: 80 + index * 0.1,
      }));
      const intake = trend.map(({ date }) => ({ date, kcal: 3000 }));
      return { intake, trend, prior: 3000 };
    };

    // The raw signal is 3,000 - (0.1 kg/day * 7,700) = 2,230 kcal.
    const tenDays = estimateExpenditure(makeInput(10));
    const fifteenDays = estimateExpenditure(makeInput(15));
    expect(tenDays).toMatchObject({ expenditure: 2487, daysUsed: 10, confidence: 'medium' });
    expect(fifteenDays).toMatchObject({ expenditure: 2422, daysUsed: 15, confidence: 'medium' });
    expect(fifteenDays.expenditure).toBeLessThan(tenDays.expenditure);
    expect(tenDays.expenditure).toBeGreaterThan(2230);
    expect(fifteenDays.expenditure).toBeGreaterThan(2230);
  });

  it('expenditureSeries never changes by more than ~100/7 kcal between consecutive days', () => {
    const sim = simulate({
      trueTdee: 2600,
      startKg: 90,
      days: 56,
      dailyIntake: 2100,
      seed: 9,
      startDate: START_DATE,
    });
    const trend = trendWeight(sim.weights);
    const series = expenditureSeries(sim.intake, trend, 2300);
    for (let i = 1; i < series.length; i++) {
      const delta = Math.abs(series[i].value - series[i - 1].value);
      expect(delta).toBeLessThanOrEqual(100 / 7 + 1);
    }
  });

  it('days without a logged intake are excluded, not treated as 0 kcal (no downward bias)', () => {
    const sim = simulate({
      trueTdee: 2600,
      startKg: 90,
      days: 56,
      dailyIntake: 2100,
      seed: 11,
      startDate: START_DATE,
      logProbability: 0.7,
    });
    const trend = trendWeight(sim.weights);
    const result = estimateExpenditure({ intake: sim.intake, trend, prior: 2300 });
    // If missing days were counted as 0 kcal, the mean intake (and thus TDEE) would collapse hard.
    expect(result.expenditure).toBeGreaterThan(2000);
    expect(Math.abs(result.expenditure - 2600)).toBeLessThanOrEqual(150);
  });

  it('duplicate same-day intake entries are summed, not double counted as separate days', () => {
    const base = simulate({
      trueTdee: 2600,
      startKg: 90,
      days: 21,
      dailyIntake: 2100,
      seed: 5,
      startDate: START_DATE,
    });
    const trend = trendWeight(base.weights);
    // Split each logged day's kcal into two "meals" on the same date; daysUsed should be unchanged.
    const splitIntake = base.intake.flatMap((e) => [
      { date: e.date, kcal: e.kcal * 0.5 },
      { date: e.date, kcal: e.kcal * 0.5 },
    ]);
    const a = estimateExpenditure({ intake: base.intake, trend, prior: 2300 });
    const b = estimateExpenditure({ intake: splitIntake, trend, prior: 2300 });
    expect(b.daysUsed).toBe(a.daysUsed);
    expect(b.expenditure).toBe(a.expenditure);
  });
});

describe('performance', () => {
  it('expenditureSeries on ~3 years of daily data finishes quickly', () => {
    const days = 365 * 3;
    const sim = simulate({
      trueTdee: 2500,
      startKg: 90,
      days,
      dailyIntake: 2500,
      seed: 1,
      startDate: START_DATE,
    });
    const trend = trendWeight(sim.weights);
    const start = performance.now();
    const series = expenditureSeries(sim.intake, trend, 2400);
    const elapsed = performance.now() - start;
    expect(series.length).toBe(trend.length);
    expect(elapsed).toBeLessThan(500);
  });
});
