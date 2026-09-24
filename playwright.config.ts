import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : { command: 'npm run dev', url: baseURL, reuseExistingServer: true },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
