import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: false,
    retries: 1,
    workers: 1,
    reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'on',
        video: 'on-first-retry',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    webServer: {
        command: 'npm run dev',
        env: {
            VITE_E2E_BYPASS_AUTH: '1',
        },
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 30000,
    },
});
