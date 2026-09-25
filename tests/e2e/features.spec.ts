import { expect, test, type Page } from '@playwright/test';

/**
 * Seeds a profile, a coached target set and `days` of weigh-ins and food logs straight into
 * IndexedDB through the app's own modules (served by the Vite dev server), so feature tests
 * don't have to click through onboarding and weeks of logging first.
 */
async function seed(page: Page, days = 42) {
  await page.goto('/onboarding');
  await page.evaluate(async (days) => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const { db } = await load('/src/db/schema.ts');
    const { newRecord } = await load('/src/db/repo.ts');
    const { addDays, today } = await load('/src/lib/utils/date.ts');
    const { targetsFromProfile } = await load('/src/lib/nutrition/index.ts');
    const start = addDays(today(), -days);
    const profile = newRecord({
      sex: 'female', birthDate: '1992-03-01', heightCm: 168, startWeightKg: 72, activity: 'light',
      goal: 'lose', goalRatePctPerWeek: -0.5, goalWeightKg: 66, diet: 'balanced',
      checkInWeekday: new Date().getDay(), onboardedAt: Date.now() - days * 86_400_000,
    });
    const { tdee, targets } = targetsFromProfile(profile, 72, 34);
    const weights: unknown[] = [];
    const logs: unknown[] = [];
    for (let i = 0; i <= days; i++) {
      const date = addDays(start, i);
      weights.push(newRecord({ date, kg: Math.round((72 - 0.05 * i + (i % 3 === 0 ? 0.3 : -0.2)) * 10) / 10, time: Date.now() }));
      if (i < days) {
        const n = { kcal: 1700, protein: 110, carbs: 190, fat: 55 };
        logs.push(newRecord({ date, meal: 1, foodId: `quick:${i}`, name: 'Seeded day', source: 'quick', grams: 100, nutrients: n, per100: n, loggedAt: Date.now() }));
      }
    }
    await db.transaction('rw', db.profile, db.weights, db.logEntries, db.targets, async () => {
      await db.profile.put(profile);
      await db.weights.bulkPut(weights);
      await db.logEntries.bulkPut(logs);
      await db.targets.put(newRecord({ effectiveFrom: start, base: targets, mode: 'coached', tdee }));
    });
  }, days);
}

test('logs, edits and shows a weigh-in on the weight page', async ({ page }) => {
  await seed(page, 5);
  await page.goto('/weight');
  await page.getByRole('button', { name: 'Log weight' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Weight', { exact: true }).fill('70.4');
  await dialog.getByLabel('Note').fill('e2e weigh-in');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('70.4').first()).toBeVisible();
});

test('weekly check-in proposes targets and applying them updates the dashboard', async ({ page }) => {
  await seed(page);
  await page.goto('/coach');
  await expect(page.getByText('Proposed daily targets')).toBeVisible();
  const proposed = await page.locator('text=/^\\d{4}kcal$/').first().innerText();
  await page.getByRole('button', { name: 'Apply targets' }).click();
  await page.goto('/');
  await expect(page.getByText(`of ${Number(proposed.replace('kcal', '')).toLocaleString('en-US')} kcal`).first()).toBeVisible();
  await expect(page.getByText('Weekly check-in ready')).toBeHidden();
});

test('progress shows energy balance, goal projection and macro averages from logged data', async ({ page }) => {
  await seed(page);
  await page.goto('/progress');
  await expect(page.getByText('Energy balance')).toBeVisible();
  await expect(page.getByText('Projected')).toBeVisible();
  await expect(page.getByText(/Averaged over \d+ logged days\./)).toBeVisible();
  await expect(page.locator('svg.recharts-surface')).toHaveCount(3);
});

test('builds a recipe from a custom food and logs a serving', async ({ page }) => {
  await seed(page, 3);
  await page.goto('/log');
  await page.getByRole('button', { name: 'Add food' }).first().click();
  const add = page.getByRole('dialog');
  await add.getByRole('button', { name: 'New food' }).click();
  await add.getByPlaceholder('Food name').fill('E2e pasta');
  await add.getByLabel(/^Calories per 100/).fill('350');
  await add.getByLabel(/^Protein per 100/).fill('12');
  await add.getByLabel(/^Carbs per 100/).fill('70');
  await add.getByLabel(/^Fat per 100/).fill('2');
  await add.getByRole('button', { name: /save|create/i }).first().click();
  await page.keyboard.press('Escape');

  await page.goto('/recipes');
  await page.getByRole('button', { name: 'New recipe' }).click();
  const builder = page.getByRole('dialog');
  await builder.getByPlaceholder('e.g. Turkey pasta').fill('E2e pasta bake');
  await builder.getByPlaceholder('Search foods to add').fill('E2e pasta');
  await builder.getByRole('button', { name: /E2e pasta/ }).first().click();
  await builder.getByLabel('E2e pasta amount').fill('400');
  await builder.getByLabel('Cooked yield').fill('800');
  await builder.getByLabel('Recipe servings').fill('4');
  await builder.getByRole('button', { name: 'Save recipe' }).click();
  await expect(page.getByText('E2e pasta bake')).toBeVisible();
  await expect(page.getByText('1 ingredients, 4 servings')).toBeVisible();

  // 400 g at 350 kcal/100 g = 1400 kcal over 4 servings: one serving is 350 kcal.
  await page.goto('/log');
  await page.getByRole('button', { name: 'Add food' }).nth(2).click();
  const log = page.getByRole('dialog');
  await log.getByPlaceholder('Search foods').fill('E2e pasta bake');
  await log.getByRole('button', { name: /E2e pasta bake/ }).first().click();
  await log.getByRole('button', { name: /^Add/ }).last().click();
  await expect(page.getByText('E2e pasta bake').first()).toBeVisible();
  await expect(page.getByText('350 kcal').first()).toBeVisible();
});

test('switching to light theme and pounds is reflected across the app', async ({ page }) => {
  await seed(page, 5);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'lb', exact: true }).click();
  await page.goto('/weight');
  await expect(page.getByText(/lb/).first()).toBeVisible();
});
