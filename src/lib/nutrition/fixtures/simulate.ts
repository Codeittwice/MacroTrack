/**
 * Synthetic data generator for testing the expenditure estimator against a known ground truth.
 * Deterministic given a seed, so tests are reproducible.
 */
import type { DateKey } from '@/db/types';
import { addDays } from '@/lib/utils/date';

/** mulberry32: small, fast, seedable PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard-normal noise via Box-Muller, drawing two uniforms from `rng` per pair. */
export function gaussian(rng: () => number, mean = 0, sd = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * sd;
}

export interface SimulateArgs {
  trueTdee: number;
  startKg: number;
  days: number;
  /** kcal actually eaten each day (before noise), constant or a function of the day index (0-based). */
  dailyIntake: number | ((day: number) => number);
  /** sd (kcal) of noise added to the intended intake to get the actually-eaten amount. */
  intakeNoiseSd?: number;
  /** sd-ish magnitude (kg) of scale/water-weight noise on top of true body weight. */
  scaleNoiseKg?: number;
  /** probability [0,1] that a given day's eaten kcal gets logged. */
  logProbability?: number;
  /** probability [0,1] that a given day gets a weigh-in. */
  weighProbability?: number;
  seed: number;
  startDate: DateKey;
}

export interface SimulateResult {
  weights: { date: DateKey; kg: number }[];
  intake: { date: DateKey; kcal: number }[];
  trueWeights: { date: DateKey; kg: number }[];
  trueTdee: number;
}

/**
 * Simulates `days` of true energy balance: w[t+1] = w[t] + (actualEaten[t] - trueTdee) / 7700.
 * `actualEaten` includes Gaussian noise around the intended `dailyIntake`. The scale reading is
 * the true weight plus uniform water noise in [-scaleNoiseKg, scaleNoiseKg]. Logged intake and
 * weigh-ins are randomly dropped per `logProbability` / `weighProbability` to simulate sparse
 * real-world logging.
 */
export function simulate(args: SimulateArgs): SimulateResult {
  const {
    trueTdee,
    startKg,
    days,
    dailyIntake,
    intakeNoiseSd = 150,
    scaleNoiseKg = 0.5,
    logProbability = 1,
    weighProbability = 1,
    seed,
    startDate,
  } = args;

  const rng = mulberry32(seed);
  const weights: { date: DateKey; kg: number }[] = [];
  const intake: { date: DateKey; kcal: number }[] = [];
  const trueWeights: { date: DateKey; kg: number }[] = [];

  let trueKg = startKg;
  for (let d = 0; d < days; d++) {
    const date = addDays(startDate, d);
    const intended = typeof dailyIntake === 'function' ? dailyIntake(d) : dailyIntake;
    const actualEaten = intended + gaussian(rng, 0, intakeNoiseSd);

    trueWeights.push({ date, kg: trueKg });

    if (rng() < logProbability) {
      intake.push({ date, kcal: actualEaten });
    }
    if (rng() < weighProbability) {
      const waterNoise = (rng() * 2 - 1) * scaleNoiseKg;
      weights.push({ date, kg: trueKg + waterNoise });
    }

    trueKg = trueKg + (actualEaten - trueTdee) / 7700;
  }

  return { weights, intake, trueWeights, trueTdee };
}
