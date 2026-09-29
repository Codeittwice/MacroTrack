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

test('imports weight and calorie history from another app', async ({ page }) => {
  await seed(page, 2);
  await page.goto('/extras/backup');
  const csv = ['Date,Weight (kg),Calories (kcal),Protein (g),Carbs (g),Fat (g)', '2026-01-05,90.2,2400,150,260,80', '2026-01-06,89.9,2300,140,250,78'].join('\n');
  await page.getByLabel('History file').setInputFiles({ name: 'macrofactor-export.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByText(/Found 2 weigh-ins and 2 days of food/)).toBeVisible();
  await expect(page.getByLabel('Source name')).toHaveValue('MacroFactor');
  await page.getByRole('button', { name: 'Import history' }).click();
  await expect(page.getByText('Imported 2 weigh-ins and 2 days of food.', { exact: false })).toBeVisible();
  await page.goto('/log/2026-01-05');
  await expect(page.getByText('MacroFactor · daily total')).toBeVisible();
});

test('estimates body fat with a tape measure and tracks body composition', async ({ page }) => {
  await seed(page, 10); // female, 168 cm
  await page.goto('/settings');
  await page.getByRole('button', { name: "Don't know it? Estimate it" }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Neck circumference').fill('33');
  await sheet.getByLabel('Waist circumference').fill('72');
  await sheet.getByLabel('Hip circumference').fill('96');
  await expect(sheet.getByRole('status')).toContainText('%');
  await sheet.getByRole('button', { name: 'Use this value' }).click();
  await expect(page.getByLabel('Body fat percentage')).not.toHaveValue('');

  await page.goto('/extras/measurements');
  await page.getByRole('button', { name: /Log/ }).first().click();
  const m = page.getByRole('dialog');
  await m.getByLabel('neck measurement').fill('33');
  await m.getByLabel('waist measurement').fill('74');
  await m.getByLabel('hips measurement').fill('97');
  await expect(m.getByText(/body fat/).first()).toBeVisible();
  await m.getByRole('button', { name: 'Save as my body fat' }).click();
  await m.getByRole('button', { name: 'Save measurements' }).click();

  await page.goto('/progress');
  await expect(page.getByText('Body composition')).toBeVisible();
  await expect(page.getByText('Lean mass')).toBeVisible();
});

test('logs a workout, updates the muscle map, and reuses it as a template', async ({ page }) => {
  await seed(page, 3);
  await page.goto('/training');
  await page.getByRole('button', { name: 'Start workout or activity' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  const picker = page.getByRole('dialog');
  await picker.getByLabel('Search exercises').fill('bench press');
  await picker.getByRole('button', { name: /^Bench press/ }).first().click();
  for (let i = 1; i <= 3; i++) {
    await page.getByLabel(`Bench press set ${i} weight`).fill('80');
    await page.getByLabel(`Bench press set ${i} reps`).fill('8');
    await page.getByRole('button', { name: `Complete Bench press set ${i}` }).click();
  }
  await expect(page.getByRole('timer', { name: 'Rest timer' })).toBeVisible();
  await page.getByRole('button', { name: 'Finish workout' }).click();

  await expect(page.getByText('1,920 kg').or(page.getByText('1.920 kg'))).toBeVisible();
  await page.getByLabel('Template name').fill('Push day');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

  await page.goto('/training');
  await expect(page.getByRole('button', { name: 'Chest: 3 sets' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Push day' }).click();
  await expect(page.getByLabel('Bench press set 3 weight')).toBeVisible();
  await expect(page.getByText('80 × 8').first()).toBeVisible(); // last time's sets as hints
});

test('tracks supplements and counts protein powder in the food log', async ({ page }) => {
  await seed(page, 3);
  await page.goto('/supplements');
  await page.getByRole('button', { name: 'Add supplement' }).first().click();
  let sheet = page.getByRole('dialog');
  await sheet.getByLabel('Supplement name').fill('Creatine');
  await sheet.getByLabel('Dose').fill('5');
  await sheet.getByRole('button', { name: 'Add supplement' }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole('button', { name: 'Add', exact: true }).click();
  sheet = page.getByRole('dialog');
  await sheet.getByLabel('Supplement name').fill('Whey');
  await sheet.getByLabel('Dose').fill('30');
  await sheet.getByLabel('Counts toward my food log').check();
  await sheet.getByLabel('Calories per dose').fill('120');
  await sheet.getByLabel('Protein per dose').fill('24');
  await sheet.getByRole('button', { name: 'Add supplement' }).click();
  await expect(sheet).toBeHidden();

  await page.goto('/');
  await page.getByRole('button', { name: 'Tick Creatine' }).click();
  await page.getByRole('button', { name: 'Tick Whey' }).click();
  await expect(page.getByText('2/2 taken')).toBeVisible();

  await page.goto('/log');
  await expect(page.getByText('Whey (30 g)')).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: 'Untick Whey' }).click();
  await page.goto('/log');
  await expect(page.getByText('Whey (30 g)')).toBeHidden();
});

test('adds workout calories to the day target when the setting is on', async ({ page }) => {
  await seed(page, 3);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Full', exact: true }).click();
  await page.goto('/training');
  await page.getByRole('button', { name: 'Start workout or activity' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByRole('dialog').getByLabel('Search exercises').fill('running');
  await page.getByRole('dialog').getByRole('button', { name: /^Running/ }).first().click();
  await page.getByLabel('Running set 1 minutes').fill('30');
  await page.getByRole('button', { name: 'Complete Running set 1' }).click();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page.getByText(/All of it is added to today's calorie target/)).toBeVisible();
  await expect(page.getByText('Active', { exact: true })).toBeVisible();
  await expect(page.getByText('30 min', { exact: true })).toBeVisible();
  await page.goto('/training');
  await expect(page.getByText(/30 min active · ~\d+ kcal/)).toBeVisible();
  await page.goto('/');
  await expect(page.getByText(/Includes \+\d+ kcal from today's training/)).toBeVisible();
});
