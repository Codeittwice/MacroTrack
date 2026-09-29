import { describe, expect, it } from 'vitest';
import { mealForTime } from './mealForTime';

function at(hh: number, mm: number): Date {
  return new Date(2024, 0, 1, hh, mm, 0, 0);
}

describe('mealForTime', () => {
  it('is breakfast just before 10:30', () => {
    expect(mealForTime(at(10, 29), 4)).toBe(0);
  });

  it('switches to lunch at 10:30', () => {
    expect(mealForTime(at(10, 30), 4)).toBe(1);
  });

  it('is lunch just before 15:00', () => {
    expect(mealForTime(at(14, 59), 4)).toBe(1);
  });

  it('switches to dinner at 15:00', () => {
    expect(mealForTime(at(15, 0), 4)).toBe(2);
  });

  it('is dinner just before 21:00', () => {
    expect(mealForTime(at(20, 59), 4)).toBe(2);
  });

  it('switches to snacks at 21:00', () => {
    expect(mealForTime(at(21, 0), 4)).toBe(3);
  });

  it('clamps to mealCount - 1 when there are fewer meals', () => {
    expect(mealForTime(at(21, 0), 2)).toBe(1);
    expect(mealForTime(at(10, 29), 2)).toBe(0);
  });

  it('clamps to 0 when mealCount is 0', () => {
    expect(mealForTime(at(21, 0), 0)).toBe(0);
  });
});
