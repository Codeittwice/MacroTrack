/**
 * Accuracy of the adaptive expenditure estimate against a simulated user with a known TDEE
 * (2026-09-30 audit). Weight follows energy balance at 7700 kcal/kg with ±0.5 kg daily scale noise
 * and ±150 kcal daily intake noise; the formula prior is 300 kcal too low, as formulas often are.
 */
import { describe, expect, it } from 'vitest';
import type { DateKey } from '@/db/types';
import { addDays } from '@/lib/utils/date';
import { estimateExpenditure } from './expenditure';
import { gaussian, mulberry32 } from './fixtures/simulate';
import { trendWeight } from './trend';

const S: DateKey = '2024-01-01';
const TRUE_TDEE = 2600;
const PRIOR = 2300;
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

function sim(seed: number, days: number, eat: number, partialDays: number[] = []) {
  const rng = mulberry32(seed);
  let kg = 90;
  const weights: { date: DateKey; kg: number }[] = [];
  const intake: { date: DateKey; kcal: number }[] = [];
  for (let d = 0; d < days; d++) {
    const date = addDays(S, d);
    const eaten = eat + gaussian(rng, 0, 150);
    weights.push({ date, kg: kg + (rng() * 2 - 1) * 0.5 });
    // On a partly logged day only breakfast made it into the log.
    intake.push({ date, kcal: partialDays.includes(d) ? eaten * 0.3 : eaten });
    kg += (eaten - TRUE_TDEE) / 7700;
  }
  return { weights, intake };
}

function run(days: number, opts: { raw: boolean; eat?: number; partialDays?: number[] }) {
  const estimates = SEEDS.map((seed) => {
    const { weights, intake } = sim(seed, days, opts.eat ?? 2100, opts.partialDays);
    return estimateExpenditure({ intake, trend: trendWeight(weights), prior: PRIOR, weights: opts.raw ? weights : undefined }).expenditure;
  });
  const mean = estimates.reduce((a, b) => a + b, 0) / estimates.length;
  const mae = estimates.reduce((a, b) => a + Math.abs(b - TRUE_TDEE), 0) / estimates.length;
  return { mean, mae };
}

describe('expenditure accuracy (simulated user, true TDEE 2600)', () => {
  it('the smoothed trend alone underestimates badly in the first weeks (why raw weigh-ins are used)', () => {
    expect(run(14, { raw: false }).mean).toBeLessThan(TRUE_TDEE - 200);
  });

  it('is within ~150 kcal on average after 2 weeks and ~100 after 3, while losing weight', () => {
    expect(run(14, { raw: true }).mae).toBeLessThan(150);
    expect(run(21, { raw: true }).mae).toBeLessThan(100);
    expect(Math.abs(run(21, { raw: true }).mean - TRUE_TDEE)).toBeLessThan(100);
  });

  it('works the same when gaining (surplus) and at maintenance', () => {
    expect(run(21, { raw: true, eat: 3000 }).mae).toBeLessThan(100);
    expect(run(21, { raw: true, eat: 2600 }).mae).toBeLessThan(100);
  });

  it('ignores partly logged days instead of reading them as real low-intake days', () => {
    const partial = [3, 8, 12, 17];
    const { weights, intake } = sim(7, 21, 2100, partial);
    const result = estimateExpenditure({ intake, trend: trendWeight(weights), prior: PRIOR, weights });
    expect(result.excludedDays).toBe(4);
    expect(result.daysUsed).toBe(17);
    expect(result.slopeSource).toBe('weighins');
    expect(run(21, { raw: true, partialDays: partial }).mae).toBeLessThan(110);
  });
});
