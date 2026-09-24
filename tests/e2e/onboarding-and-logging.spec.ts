import { expect, test } from '@playwright/test';

test('onboards a new user and logs a quick meal', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Get started' }).click();

  await page.getByRole('button', { name: 'Male', exact: true }).click();
  await page.locator('input[type="date"]').fill('1990-06-15');
  await page.getByPlaceholder('e.g. 175').fill('175');
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByPlaceholder('e.g. 80').fill('80');
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: 'Moderately active' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByPlaceholder('e.g. 75').fill('75');
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: 'Balanced' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: 'Monday' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start tracking' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: /kcal consumed/ })).toBeVisible();

  await page.getByRole('link', { name: 'Food log' }).click();
  await page.getByRole('button', { name: 'Add food' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Quick add' }).click();
  await dialog.getByLabel('Quick add calories').fill('400');
  await dialog.getByLabel('Quick add protein').fill('30');
  await dialog.getByLabel('Quick add carbs').fill('40');
  await dialog.getByLabel('Quick add fat').fill('10');
  await dialog.getByRole('button', { name: 'Add to log' }).click();

  await expect(page.getByRole('button', { name: 'Edit Quick add' }).first()).toBeVisible();
  await expect(page.getByText('400 kcal').first()).toBeVisible();
});
