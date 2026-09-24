import { describe, it, expect } from 'vitest';
import { excludeWeightOutliers, trendWeight, weeklyRate, lsSlopePerDay } from './trend';
import { addDays } from '@/lib/utils/date';
import type { DateKey } from '@/db/types';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('trendWeight', () => {
  it('returns [] for empty input', () => {
    expect(trendWeight([])).toEqual([]);
  });

  it('returns a single point for a single day', () => {
    const out = trendWeight([{ date: '2026-01-01', kg: 80 }]);
    expect(out).toEqual([{ date: '2026-01-01', value: 80 }]);
  });

  it('alpha = 1 makes the trend equal the raw (interpolated) series', () => {
    const out = trendWeight(
      [
        { date: '2026-01-01', kg: 80 },
        { date: '2026-01-03', kg: 82 },
      ],
      1
    );
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ date: '2026-01-01', value: 80 });
    expect(out[1].value).toBeCloseTo(81, 10);
    expect(out[2]).toEqual({ date: '2026-01-03', value: 82 });
  });

  it('a constant weight gives a constant trend', () => {
    const weights = Array.from({ length: 20 }, (_, i) => ({ date: addDays('2026-01-01', i), kg: 75 }));
    const out = trendWeight(weights);
    expect(out).toHaveLength(20);
    for (const p of out) expect(p.value).toBeCloseTo(75, 10);
  });

  it('ignores non-finite or <= 0 kg entries', () => {
    const out = trendWeight([
      { date: '2026-01-01', kg: 80 },
      { date: '2026-01-02', kg: NaN },
      { date: '2026-01-02', kg: -5 },
      { date: '2026-01-02', kg: 0 },
      { date: '2026-01-02', kg: Infinity },
      { date: '2026-01-03', kg: 82 },
    ]);
    // day 2 has no valid entries -> interpolated between day1 and day3
    expect(out).toHaveLength(3);
    expect(out[1].date).toBe('2026-01-02');
    // raw interpolated value on day 2 is 81, EMA: trend0=80, trend1 = 80 + 0.1*(81-80) = 80.1
    expect(out[1].value).toBeCloseTo(80.1, 10);
  });

  it('handles unsorted, duplicate-date, and gapped input; averages same-day entries and interpolates gaps', () => {
    // Two weigh-ins on day1 (80, 81 -> avg 80.5), then a 3-day gap before day5 = 84.5,
    // entries shuffled out of order.
    const entries = [
      { date: '2026-02-05' as DateKey, kg: 84.5 },
      { date: '2026-02-01' as DateKey, kg: 81 },
      { date: '2026-02-01' as DateKey, kg: 80 },
    ];
    const out = trendWeight(entries);
    // one point per calendar day from 02-01 to 02-05
    expect(out.map((p) => p.date)).toEqual(['2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04', '2026-02-05']);
    expect(out).toHaveLength(5);
    // sorted ascending, no dup dates
    const dates = out.map((p) => p.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect([...dates].sort()).toEqual(dates);

    // day0 raw = avg(80,81) = 80.5, seeds trend[0]
    expect(out[0].value).toBeCloseTo(80.5, 10);

    // linear interpolation from 80.5 (day1) to 84.5 (day5) over 4 days -> +1/day
    const rawByIndex = [80.5, 81.5, 82.5, 83.5, 84.5];
    let trend = rawByIndex[0];
    const expected = [trend];
    for (let i = 1; i < rawByIndex.length; i++) {
      trend = trend + 0.1 * (rawByIndex[i] - trend);
      expected.push(trend);
    }
    out.forEach((p, i) => expect(p.value).toBeCloseTo(expected[i], 10));
  });

  it('is robust to fully unsorted, jumbled multi-day input', () => {
    const shuffled = [
      { date: '2026-03-04' as DateKey, kg: 79 },
      { date: '2026-03-01' as DateKey, kg: 80 },
      { date: '2026-03-02' as DateKey, kg: 79.5 },
      { date: '2026-03-01' as DateKey, kg: 80.2 },
    ];
    const out = trendWeight(shuffled);
    expect(out.map((p) => p.date)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04']);
  });

  it('excludes an implausible isolated average without changing the stored raw days', () => {
    const known = Array.from({ length: 7 }, (_, index) => ({ date: addDays('2026-04-01', index), kg: index === 3 ? 90 : 80 }));
    expect(excludeWeightOutliers(known).map((point) => point.date)).not.toContain('2026-04-04');
    expect(trendWeight(known).every((point) => point.value === 80)).toBe(true);
  });

  it('keeps a sustained change that has local support', () => {
    const known = Array.from({ length: 8 }, (_, index) => ({ date: addDays('2026-05-01', index), kg: index < 4 ? 80 : 84 }));
    expect(excludeWeightOutliers(known)).toHaveLength(8);
  });
});

describe('weeklyRate', () => {
  it('returns 0 for fewer than 2 points', () => {
    expect(weeklyRate([])).toBe(0);
    expect(weeklyRate([{ date: '2026-01-01', value: 80 }])).toBe(0);
  });

  it('a linear ramp: after ~60 days the trend slope matches the ramp slope within 1%', () => {
    const rateKgPerWeek = -0.7;
    const kgPerDay = rateKgPerWeek / 7;
    const weights = Array.from({ length: 90 }, (_, i) => ({
      date: addDays('2026-01-01', i),
      kg: 90 + kgPerDay * i,
    }));
    const trend = trendWeight(weights);
    const rate = weeklyRate(trend.slice(60)); // after the EMA has settled into the slope
    expect(Math.abs(rate - rateKgPerWeek)).toBeLessThan(Math.abs(rateKgPerWeek) * 0.01);
  });

  it('noisy data around a -0.5 kg/wk trend stays within +-0.15 kg/wk using a seeded PRNG', () => {
    const rand = mulberry32(42);
    const rateKgPerWeek = -0.5;
    const kgPerDay = rateKgPerWeek / 7;
    const weights = Array.from({ length: 56 }, (_, i) => ({
      date: addDays('2026-01-01', i),
      kg: 90 + kgPerDay * i + (rand() - 0.5), // +-0.5 kg uniform noise
    }));
    const trend = trendWeight(weights);
    const rate = weeklyRate(trend, 56);
    expect(Math.abs(rate - rateKgPerWeek)).toBeLessThan(0.15);
  });

  it('uses least squares, not just the two endpoints (a plausible final change changes the answer)', () => {
    // Flat weight, then a modest final increase that should not be treated as a typo.
    const base: { date: DateKey; kg: number }[] = Array.from({ length: 15 }, (_, i) => ({
      date: addDays('2026-01-01', i),
      kg: 80,
    }));
    base[base.length - 1] = { ...base[base.length - 1], kg: 82 };
    const trend = trendWeight(base);

    const endpointRate =
      ((trend[trend.length - 1].value - trend[0].value) /
        (new Date(trend[trend.length - 1].date).getTime() - new Date(trend[0].date).getTime())) *
      86_400_000 *
      7;
    const lsRate = weeklyRate(trend, 14);

    // LS uses all points, so it is pulled toward 0 much less aggressively than the raw endpoint delta,
    // and the two should differ meaningfully.
    expect(Math.abs(lsRate - endpointRate)).toBeGreaterThan(0.01);
  });

  it('returns 0 when the window has zero x-variance', () => {
    const points = [
      { date: '2026-01-01', value: 80 },
      { date: '2026-01-01', value: 81 },
    ];
    expect(lsSlopePerDay(points)).toBe(0);
  });
});
