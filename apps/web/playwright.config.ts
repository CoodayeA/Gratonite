import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'CORS_ORIGIN=http://127.0.0.1:4173 pnpm --filter @gratonite/api exec node --import tsx src/index.ts',
      url: 'http://127.0.0.1:4000/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'VITE_API_URL=http://127.0.0.1:4000/api/v1 pnpm --filter @gratonite/web exec vite --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env['PW_USE_CHROME_CHANNEL'] === '1' ? { channel: 'chrome' as const } : {}),
      },
    },
  ],
});
