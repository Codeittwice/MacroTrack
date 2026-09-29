import { describe, it, expect } from 'vitest';
import { loggingStreak } from './streak';

describe('loggingStreak', () => {
  it('returns 0 for empty input', () => {
    expect(loggingStreak([], '2026-01-10')).toBe(0);
  });

  it('returns 1 when only today has an entry', () => {
    expect(loggingStreak(['2026-01-10'], '2026-01-10')).toBe(1);
  });

  it('counts 3 consecutive days ending today', () => {
    expect(loggingStreak(['2026-01-08', '2026-01-09', '2026-01-10'], '2026-01-10')).toBe(3);
  });

  it('counts days ending yesterday when today has no entry yet', () => {
    expect(loggingStreak(['2026-01-08', '2026-01-09'], '2026-01-10')).toBe(2);
  });

  it('returns 0 when there is a gap of 2+ days before today', () => {
    expect(loggingStreak(['2026-01-05', '2026-01-06'], '2026-01-10')).toBe(0);
  });

  it('handles duplicates and unsorted input', () => {
    const dates = ['2026-01-10', '2026-01-08', '2026-01-09', '2026-01-09', '2026-01-08'];
    expect(loggingStreak(dates, '2026-01-10')).toBe(3);
  });

  it('handles a month boundary', () => {
    expect(loggingStreak(['2026-02-28', '2026-03-01'], '2026-03-01')).toBe(2);
  });

  it('stops at the first gap looking backward', () => {
    expect(loggingStreak(['2026-01-01', '2026-01-09', '2026-01-10'], '2026-01-10')).toBe(2);
  });
});
