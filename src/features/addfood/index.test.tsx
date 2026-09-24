import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { db } from '@/db/schema';
import type { FoodItem } from '@/db/types';
import { addLogEntry } from '@/lib/log/actions';
import { getDayEntries } from '@/lib/log/queries';
import { AddFoodSheet, FoodDetailSheet } from './index';

const DATE = '2026-09-24';

const FOOD: FoodItem = {
  id: 'nevo:smoke-food',
  source: 'nevo',
  name: 'Smoke food',
  per100: { kcal: 180, protein: 12, carbs: 20, fat: 5 },
  servings: [],
};

beforeEach(async () => {
  await Promise.all([db.foods.clear(), db.logEntries.clear(), db.settings.clear()]);
});

afterEach(() => cleanup());

describe('AddFoodSheet', () => {
  it('creates a custom food and logs its default amount', async () => {
    const onClose = vi.fn();
    render(<AddFoodSheet open onClose={onClose} date={DATE} meal={0} />);

    fireEvent.click(screen.getByRole('button', { name: 'New food' }));
    fireEvent.change(screen.getByPlaceholderText('Food name'), { target: { value: 'Test yoghurt' } });
    fireEvent.change(screen.getByLabelText('Calories per 100'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Protein per 100'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Carbs per 100'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Fat per 100'), { target: { value: '4' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create food' }));
    expect(await screen.findByText('Test yoghurt')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Add to log' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    const entries = await getDayEntries(DATE);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ name: 'Test yoghurt', source: 'user', grams: 100, meal: 0 });
    expect(entries[0].nutrients).toMatchObject({ kcal: 120, protein: 10, carbs: 8, fat: 4 });
  });

  it('logs a quick macro entry', async () => {
    const onClose = vi.fn();
    render(<AddFoodSheet open onClose={onClose} date={DATE} meal={1} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quick add' }));
    fireEvent.change(screen.getByLabelText('Quick add calories'), { target: { value: '250' } });
    fireEvent.change(screen.getByLabelText('Quick add protein'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Quick add carbs'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Quick add fat'), { target: { value: '8' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add to log' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    const [entry] = await getDayEntries(DATE);
    expect(entry).toMatchObject({ source: 'quick', meal: 1, grams: 100 });
    expect(entry.nutrients).toMatchObject({ kcal: 250, protein: 20, carbs: 30, fat: 8 });
  });

  it('opens the describe-meal tab and requires the selected provider key', async () => {
    render(<AddFoodSheet open onClose={vi.fn()} date={DATE} meal={0} initialTab="ai" />);

    expect(screen.getByLabelText('Meal description')).toBeTruthy();
    expect(screen.getByText('Add a Claude API key in Settings to estimate meals.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Estimate meal' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('FoodDetailSheet', () => {
  it('updates amount and moves the entry to the selected date and meal', async () => {
    const entry = await addLogEntry({ date: DATE, meal: 0, food: FOOD, grams: 100 });
    const onDone = vi.fn();
    render(<FoodDetailSheet open onClose={vi.fn()} entry={entry} date={DATE} meal={0} onDone={onDone} />);

    fireEvent.change(screen.getByLabelText('Entry amount'), { target: { value: '150' } });
    fireEvent.change(screen.getByDisplayValue('Breakfast'), { target: { value: '1' } });
    fireEvent.change(screen.getByDisplayValue(DATE), { target: { value: '2026-09-25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    const [updated] = await getDayEntries('2026-09-25');
    expect(updated).toMatchObject({ id: entry.id, meal: 1, grams: 150 });
    expect(updated.nutrients.kcal).toBeCloseTo(270, 5);
  });
});
