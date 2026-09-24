import { describe, expect, it } from 'vitest';
import {
  addMeal, atwaterKcal, kcalMismatch, moveMeal, removeMeal, renameMeal, sanitizeMealNames,
  signedRate, validateAge, validateBodyFatPct, validateHeightCm, validateWaterGoalMl, validateWeightKg,
} from './helpers';

describe('atwaterKcal', () => {
  it('computes 4P + 4C + 9F', () => {
    expect(atwaterKcal(150, 200, 60)).toBe(4 * 150 + 4 * 200 + 9 * 60);
  });
});

describe('kcalMismatch', () => {
  it('flags a difference greater than 5%', () => {
    expect(kcalMismatch(2000, 2200)).toBe(true);
    expect(kcalMismatch(2000, 2050)).toBe(false);
  });
  it('is false for non-finite or non-positive entered kcal', () => {
    expect(kcalMismatch(0, 100)).toBe(false);
    expect(kcalMismatch(Number.NaN, 100)).toBe(false);
  });
});

describe('validators', () => {
  it('height', () => {
    expect(validateHeightCm(119)).toBe(false);
    expect(validateHeightCm(120)).toBe(true);
    expect(validateHeightCm(230)).toBe(true);
    expect(validateHeightCm(231)).toBe(false);
  });
  it('weight', () => {
    expect(validateWeightKg(29)).toBe(false);
    expect(validateWeightKg(300)).toBe(true);
    expect(validateWeightKg(301)).toBe(false);
  });
  it('age', () => {
    expect(validateAge(13)).toBe(false);
    expect(validateAge(14)).toBe(true);
    expect(validateAge(100)).toBe(true);
    expect(validateAge(101)).toBe(false);
  });
  it('body fat', () => {
    expect(validateBodyFatPct(2)).toBe(false);
    expect(validateBodyFatPct(3)).toBe(true);
    expect(validateBodyFatPct(60)).toBe(true);
    expect(validateBodyFatPct(61)).toBe(false);
  });
  it('water goal', () => {
    expect(validateWaterGoalMl(249)).toBe(false);
    expect(validateWaterGoalMl(250)).toBe(true);
    expect(validateWaterGoalMl(10_000)).toBe(true);
    expect(validateWaterGoalMl(10_001)).toBe(false);
  });
});

describe('signedRate', () => {
  it('derives sign from goal', () => {
    expect(signedRate('lose', 0.5)).toBe(-0.5);
    expect(signedRate('gain', 0.5)).toBe(0.5);
    expect(signedRate('maintain', 0.5)).toBe(0);
    expect(signedRate('lose', -0.5)).toBe(-0.5);
  });
});

describe('meal list ops', () => {
  const names = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

  it('renames by index', () => {
    expect(renameMeal(names, 1, 'Brunch')).toEqual(['Breakfast', 'Brunch', 'Dinner', 'Snacks']);
  });
  it('adds a meal', () => {
    expect(addMeal(names)).toEqual([...names, 'New meal']);
  });
  it('removes a meal but never the last one', () => {
    expect(removeMeal(names, 0)).toEqual(['Lunch', 'Dinner', 'Snacks']);
    expect(removeMeal(['Only'], 0)).toEqual(['Only']);
  });
  it('moves a meal up/down and clamps at the edges', () => {
    expect(moveMeal(names, 1, -1)).toEqual(['Lunch', 'Breakfast', 'Dinner', 'Snacks']);
    expect(moveMeal(names, 0, -1)).toEqual(names);
    expect(moveMeal(names, 3, 1)).toEqual(names);
  });
  it('sanitizeMealNames trims and rejects empty names', () => {
    expect(sanitizeMealNames([' Breakfast ', 'Lunch'])).toEqual(['Breakfast', 'Lunch']);
    expect(sanitizeMealNames(['Breakfast', '   '])).toBeNull();
  });
});
