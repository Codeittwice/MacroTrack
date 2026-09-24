import { expect, test, type Page } from '@playwright/test';

async function completeOnboarding(page: Page) {
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
}

test('onboards a new user, logs a quick meal, and updates the dashboard', async ({ page }) => {
  await completeOnboarding(page);

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

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('button', { name: /400 of .* kcal consumed/ })).toBeVisible();
});

test('exports and restores a backup through the UI', async ({ page }) => {
  await completeOnboarding(page);
  await page.getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: 'Export, import and backup' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Expected backup download data.');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));

  await page.goto('/extras/water');
  await page.getByRole('button', { name: '+250 ml' }).click();
  await expect(page.getByText('250 ml').first()).toBeVisible();

  await page.goto('/extras/backup');
  await page.getByLabel('Backup file').setInputFiles({ name: 'macrotrack-backup.json', mimeType: 'application/json', buffer: Buffer.concat(chunks) });
  await page.getByRole('button', { name: 'Restore backup' }).click();
  await page.getByRole('button', { name: 'Tap again to replace data' }).click();
  await expect(page.getByRole('status')).toHaveText('Backup restored.');

  await page.goto('/extras/water');
  await expect(page.getByText('0 ml').first()).toBeVisible();
});
