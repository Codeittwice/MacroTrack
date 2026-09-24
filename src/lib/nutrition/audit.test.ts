/**
 * Independent audit tests (Auditor A1). Hand-computed reference values, adversarial scenarios for
 * the expenditure estimator, and `it.fails` cases documenting genuine bugs found during the audit.
 */
import { describe, expect, it } from 'vitest';
import type { DateKey, Profile } from '@/db/types';
import { addDays, fromDateKey } from '@/lib/utils/date';
import { bmr } from './bmr';
import { proposeCheckIn } from './checkin';
import { estimateExpenditure, expenditureSeries } from './expenditure';
import { gaussian, mulberry32, simulate } from './fixtures/simulate';
import { computeTargets } from './targets';
import { trendWeight } from './trend';

const S: DateKey = '2024-01-01';
const SEEDS = [1, 2, 3, 4, 5];

/**
 * Like fixtures/simulate but with a time-varying true TDEE, an additive water-weight term, a logging
 * predicate and an optional "logged != eaten" override (for logging typos).
 */
function sim(opts: {
  days: number;
  seed: number;
  tdee: (d: number) => number;
  intake: (d: number) => number;
  water?: (d: number) => number;
  logIf?: (date: DateKey) => boolean;
  logged?: (d: number, eaten: number) => number;
}) {
  const rng = mulberry32(opts.seed);
  let kg = 90;
  const weights: { date: DateKey; kg: number }[] = [];
  const intake: { date: DateKey; kcal: number }[] = [];
  for (let d = 0; d < opts.days; d++) {
    const date = addDays(S, d);
    const eaten = opts.intake(d) + gaussian(rng, 0, 150);
    const noise = (rng() * 2 - 1) * 0.5;
    weights.push({ date, kg: kg + noise + (opts.water?.(d) ?? 0) });
    if (!opts.logIf || opts.logIf(date)) intake.push({ date, kcal: opts.logged ? opts.logged(d, eaten) : eaten });
    kg += (eaten - opts.tdee(d)) / 7700;
  }
  return { weights, intake };
}

function makeProfile(): Profile {
  return {
    id: 'p',
    updatedAt: 0,
    sex: 'male',
    birthDate: '1990-01-01',
    heightCm: 180,
    startWeightKg: 90,
    activity: 'sedentary',
    goal: 'lose',
    goalRatePctPerWeek: -0.5,
    diet: 'balanced',
    checkInWeekday: 1,
    onboardedAt: 0,
  };
}

describe('audit: hand-computed references', () => {
  it('Mifflin-St Jeor female 70 kg / 170 cm / 40 y = 1401.5; Katch-McArdle 100 kg @ 30% = 1882', () => {
    // 700 + 1062.5 - 200 - 161 = 1401.5
    expect(bmr({ sex: 'female', age: 40, heightCm: 170, weightKg: 70 })).toBeCloseTo(1401.5, 6);
    // LBM = 70 -> 370 + 21.6*70 = 1882
    expect(bmr({ sex: 'male', age: 40, heightCm: 170, weightKg: 100, bodyFatPct: 30 })).toBeCloseTo(1882, 6);
  });

  it('balanced male 80 kg, TDEE 2500, -0.5%/wk -> 2060 kcal, P144 F69 C216', () => {
    // kcal = 2500 - 0.4*1100 = 2060; P = 1.8*80 = 144; F = 2060*0.3/9 = 68.67 -> 69;
    // C = round((2060 - 576 - 621)/4) = round(215.75) = 216; Atwater = 2061
    expect(computeTargets({ tdee: 2500, weightKg: 80, goalRatePctPerWeek: -0.5, diet: 'balanced', sex: 'male' })).toEqual({
      kcal: 2060,
      protein: 144,
      fat: 69,
      carbs: 216,
    });
  });

  it('keto female 60 kg, TDEE 2000, -0.5%/wk -> 1670 kcal, P108 C17 F130 (Atwater exact)', () => {
    // kcal = 2000 - 0.3*1100 = 1670; P = 108; F target = 1670*0.7/9 = 129.9; carbs = (1670-432-1169)/4 = 17.25
    expect(computeTargets({ tdee: 2000, weightKg: 60, goalRatePctPerWeek: -0.5, diet: 'keto', sex: 'female' })).toEqual({
      kcal: 1670,
      protein: 108,
      carbs: 17,
      fat: 130,
    });
  });

  it('overflow: 150 kg female high-protein at 1200 floor keeps the fat floor (90 g) and trims protein', () => {
    // fat floor 0.6*150 = 90 g = 810 kcal; protein = (1200-810)/4 = 97.5 -> 98; carbs 0
    expect(computeTargets({ tdee: 1400, weightKg: 150, goalRatePctPerWeek: -1.5, diet: 'high-protein', sex: 'female' })).toEqual({
      kcal: 1200,
      protein: 98,
      fat: 90,
      carbs: 0,
    });
  });

  it('EMA sequence 80, 82 (gap), 79: raw 80, 81, 82, 79 -> 80, 80.1, 80.29, 80.161', () => {
    const t = trendWeight([
      { date: '2026-01-01', kg: 80 },
      { date: '2026-01-03', kg: 82 },
      { date: '2026-01-04', kg: 79 },
    ]).map((p) => p.value);
    expect(t[0]).toBeCloseTo(80, 10);
    expect(t[1]).toBeCloseTo(80.1, 10);
    expect(t[2]).toBeCloseTo(80.29, 10);
    expect(t[3]).toBeCloseTo(80.161, 10);
  });
});

describe('audit: expenditure sign convention and prior independence', () => {
  it('losing weight on 2000 kcal means expenditure > intake; gaining means expenditure < intake', () => {
    const lose = simulate({ trueTdee: 2600, startKg: 90, days: 42, dailyIntake: 2000, seed: 1, startDate: S });
    const gain = simulate({ trueTdee: 2600, startKg: 90, days: 42, dailyIntake: 3200, seed: 1, startDate: S });
    // prior deliberately on the wrong side of intake in both cases
    const l = estimateExpenditure({ intake: lose.intake, trend: trendWeight(lose.weights), prior: 1800 });
    const g = estimateExpenditure({ intake: gain.intake, trend: trendWeight(gain.weights), prior: 3400 });
    expect(l.expenditure).toBeGreaterThan(2000);
    expect(g.expenditure).toBeLessThan(3200);
  });

  for (const [label, truth, intake] of [
    ['cut', 2600, 2100],
    ['bulk', 2400, 2800],
    ['maintenance', 2500, 2500],
  ] as const) {
    it(`${label}: still converges within +/-75 with a prior that is wrong by +/-400`, () => {
      for (const seed of SEEDS) {
        for (const off of [-400, 400]) {
          const s = simulate({ trueTdee: truth, startKg: 90, days: 56, dailyIntake: intake, seed, startDate: S });
          const series = expenditureSeries(s.intake, trendWeight(s.weights), truth + off);
          expect(Math.abs(series[series.length - 1].value - truth), `seed ${seed} off ${off}`).toBeLessThanOrEqual(75);
        }
      }
    });
  }
});

describe('audit: adversarial scenarios', () => {
  it('(a) true TDEE declining 2700 -> 2450 over 12 weeks: tracked within +/-150 from week 4 (lag ~19 d)', () => {
    const days = 84;
    const tdee = (d: number) => 2700 - (250 * d) / (days - 1);
    for (const seed of SEEDS) {
      const s = sim({ days, seed, tdee, intake: () => 2100 });
      const series = expenditureSeries(s.intake, trendWeight(s.weights), 2700);
      for (let d = 28; d < days; d++) {
        expect(Math.abs(series[d].value - tdee(d)), `seed ${seed} day ${d}`).toBeLessThanOrEqual(150);
      }
      // The estimate must actually come down, not stay at the 2700 prior.
      expect(series[days - 1].value).toBeLessThan(2600);
    }
  });

  it('(b) a +1.5 kg water step for 3 days moves the expenditure series by < 150 kcal', () => {
    for (const seed of SEEDS) {
      const base = sim({ days: 70, seed, tdee: () => 2600, intake: () => 2100 });
      const step = sim({ days: 70, seed, tdee: () => 2600, intake: () => 2100, water: (d) => (d >= 49 && d < 52 ? 1.5 : 0) });
      const a = expenditureSeries(base.intake, trendWeight(base.weights), 2600);
      const b = expenditureSeries(step.intake, trendWeight(step.weights), 2600);
      const maxDiff = Math.max(...a.map((p, i) => Math.abs(p.value - b[i].value)));
      expect(maxDiff, `seed ${seed}`).toBeLessThan(150);
    }
  });

  it('(c) weekday-only logging (same intake on weekends) still recovers TDEE within +/-100', () => {
    const weekday = (date: DateKey) => {
      const g = fromDateKey(date).getDay();
      return g !== 0 && g !== 6;
    };
    for (const seed of SEEDS) {
      const s = sim({ days: 56, seed, tdee: () => 2600, intake: () => 2100, logIf: weekday });
      const series = expenditureSeries(s.intake, trendWeight(s.weights), 2300);
      expect(Math.abs(series[55].value - 2600), `seed ${seed}`).toBeLessThanOrEqual(100);
    }
    // NOTE (not asserted): if unlogged weekends are +1000 kcal, the estimate is biased ~-300 kcal.
    // That is inherent to excluding unlogged days and cannot be detected from the data.
  });

  it('(d) a single mis-logged 5000 kcal day moves the series by < 150 kcal', () => {
    for (const seed of SEEDS) {
      const base = sim({ days: 70, seed, tdee: () => 2600, intake: () => 2100 });
      const typo = sim({ days: 70, seed, tdee: () => 2600, intake: () => 2100, logged: (d, e) => (d === 50 ? 5000 : e) });
      const a = expenditureSeries(base.intake, trendWeight(base.weights), 2600);
      const b = expenditureSeries(typo.intake, trendWeight(typo.weights), 2600);
      const maxDiff = Math.max(...a.map((p, i) => Math.abs(p.value - b[i].value)));
      expect(maxDiff, `seed ${seed}`).toBeLessThan(150);
    }
  });

  it('(e) units: all kg, so a constant kg offset on every weigh-in leaves the estimate unchanged', () => {
    // No lb anywhere in src/lib/nutrition; a pure offset in kg must not change the estimate.
    const s = simulate({ trueTdee: 2600, startKg: 90, days: 42, dailyIntake: 2100, seed: 4, startDate: S });
    const a = estimateExpenditure({ intake: s.intake, trend: trendWeight(s.weights), prior: 2500 });
    const shifted = s.weights.map((w) => ({ ...w, kg: w.kg + 20 }));
    const b = estimateExpenditure({ intake: s.intake, trend: trendWeight(shifted), prior: 2500 });
    expect(b.expenditure).toBe(a.expenditure);
  });
});

describe('audit: edge cases', () => {
  it('empty / single weigh-in / zero-length window fall back to the prior with low confidence', () => {
    const s = simulate({ trueTdee: 2600, startKg: 90, days: 30, dailyIntake: 2100, seed: 1, startDate: S });
    const tr = trendWeight(s.weights);
    expect(estimateExpenditure({ intake: [], trend: [], prior: 2500 })).toEqual({ expenditure: 2500, confidence: 'low', daysUsed: 0 });
    expect(estimateExpenditure({ intake: s.intake, trend: tr.slice(0, 1), prior: 2500 })).toMatchObject({ expenditure: 2500, confidence: 'low' });
    expect(estimateExpenditure({ intake: s.intake, trend: tr, prior: 2500, windowDays: 0 })).toMatchObject({ expenditure: 2500, daysUsed: 0 });
    expect(expenditureSeries([], [], 2500)).toEqual([]);
  });

  it('proposeCheckIn ignores weights and intake dated after the check-in date', () => {
    const s = simulate({ trueTdee: 2600, startKg: 90, days: 56, dailyIntake: 2100, seed: 2, startDate: S });
    const date = addDays(S, 41);
    const args = { profile: makeProfile(), currentWeightKg: 88, age: 34, date };
    const full = proposeCheckIn({ ...args, weights: s.weights, intake: s.intake });
    const cut = proposeCheckIn({
      ...args,
      weights: s.weights.filter((w) => w.date <= date),
      intake: s.intake.filter((e) => e.date <= date),
    });
    expect(full).toEqual(cut);
  });

  // Regression (Audit A1 bug 1): a non-finite kcal entry used to make the estimate NaN, and
  // expenditureSeries carried the NaN forward via `previous` forever.
  it('a single NaN intake entry must not poison expenditureSeries forever', () => {
    const s = simulate({ trueTdee: 2600, startKg: 90, days: 80, dailyIntake: 2100, seed: 1, startDate: S });
    const bad = [...s.intake, { date: s.intake[20].date, kcal: NaN }];
    const series = expenditureSeries(bad, trendWeight(s.weights), 2500);
    expect(Number.isFinite(series[79].value)).toBe(true);
  });

  // Regression (Audit A1 bug 3): the formula prior must use the trend weight, not the raw
  // `currentWeightKg`, so one scale reading cannot swing the proposal.
  it('with a trend available, the check-in expenditure should not depend on the raw currentWeightKg', () => {
    const s = simulate({ trueTdee: 2600, startKg: 90, days: 5, dailyIntake: 2100, seed: 1, startDate: S });
    const base = { profile: makeProfile(), weights: s.weights, intake: s.intake, age: 34, date: addDays(S, 4) };
    const a = proposeCheckIn({ ...base, currentWeightKg: 88 });
    const b = proposeCheckIn({ ...base, currentWeightKg: 92 });
    expect(a.expenditure).toBe(b.expenditure);
  });
});

describe('audit regressions', () => {
  it('check-in flags stale weigh-ins with low confidence', () => {
    const s = simulate({ trueTdee: 2600, startKg: 90, days: 60, dailyIntake: 2100, seed: 1, startDate: S });
    const weights = s.weights.filter((w) => w.date <= addDays(S, 19));
    const r = proposeCheckIn({ profile: makeProfile(), weights, intake: s.intake, age: 34, date: addDays(S, 59), currentWeightKg: 88 });
    expect(r.staleDays).toBe(40);
    expect(r.confidence).toBe('low');
  });

  it('negative or NaN daysSincePrevious falls back to a sane cap', () => {
    const s = simulate({ trueTdee: 2600, startKg: 90, days: 30, dailyIntake: 2100, seed: 1, startDate: S });
    const trend = trendWeight(s.weights);
    const ok = estimateExpenditure({ intake: s.intake, trend, prior: 2500, previous: 2500 });
    const neg = estimateExpenditure({ intake: s.intake, trend, prior: 2500, previous: 2500, daysSincePrevious: -7 });
    const nan = estimateExpenditure({ intake: s.intake, trend, prior: 2500, previous: 2500, daysSincePrevious: NaN });
    expect(Number.isFinite(nan.expenditure)).toBe(true);
    expect(nan.expenditure).toBe(ok.expenditure);
    expect(neg.expenditure).toBe(2500);
  });
});
