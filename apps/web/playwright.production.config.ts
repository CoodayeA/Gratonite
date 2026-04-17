import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    testMatch: /production-smoke\.spec\.ts/,
    fullyParallel: false,
    retries: 1,
    workers: 1,
    timeout: 90000,
    reporter: [['html', { outputFolder: 'playwright-report-production' }], ['list']],
    use: {
        baseURL: process.env.SMOKE_BASE_URL || 'https://gratonite.chat',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
});
