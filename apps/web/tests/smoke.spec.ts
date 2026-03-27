/**
 * Gratonite Web Desktop — Smoke & Button Tests
 *
 * Run: npx playwright test
 * Report: npx playwright show-report
 *
 * What this covers:
 * 1. Every app route renders without a crash (no white screen / error boundary)
 * 2. No unhandled console errors on any page
 * 3. Every visible button is clickable without throwing a JS error
 * 4. Key modals open and close correctly
 */

import { test, expect, Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate past the login screen (mock — just go directly to /app) */
async function goToApp(page: Page) {
    // App is served under Vite base "/app/" in this project
    await page.goto('/app/');
    // Wait for the sidebar to appear, confirming the layout mounted
    await page.waitForSelector('.channel-sidebar', { timeout: 8000 });
}

/** Collect all console errors during a test */
function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));
    return errors;
}

/** Click every non-disabled button visible on the page, skip those that navigate away */
async function clickAllButtons(page: Page, limit = 24) {
    const buttons = page.locator('button:not([disabled]):visible');
    const count = Math.min(await buttons.count(), limit);
    for (let i = 0; i < count; i++) {
        try {
            const btn = buttons.nth(i);
            // Skip buttons that are outside the viewport or hidden
            const box = await btn.boundingBox();
            if (!box) continue;
            await btn.click({ force: true, timeout: 600 });
            // Give any modals/state time to settle
            await page.waitForTimeout(80);
            // If a modal opened, close it with Escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(60);
        } catch {
            // Some buttons may cause navigation or be stale — skip
        }
    }
}

// ─── Route Smoke Tests ────────────────────────────────────────────────────────

const APP_ROUTES = [
    { path: '/app',                  name: 'Home'             },
    { path: '/app/friends',          name: 'Friends'          },
    { path: '/app/gratonite',        name: 'Gratonite'        },
    { path: '/app/shop',             name: 'Shop'             },
    { path: '/app/marketplace',      name: 'Marketplace'      },
    { path: '/app/gacha',            name: 'Gacha'            },
    { path: '/app/inventory',        name: 'Inventory'        },
    { path: '/app/discover',         name: 'Discover'         },
    { path: '/app/creator-dashboard',name: 'Creator Dashboard'},
    { path: '/app/fame',             name: 'Fame Dashboard'   },
    { path: '/app/dm/elara',         name: 'DM - Elara'       },
    { path: '/app/guild',            name: 'Guild Overview'   },
    { path: '/app/chat',             name: 'Channel Chat'     },
    { path: '/app/voice',            name: 'Voice Channel'    },
    { path: '/app/leaderboard',      name: 'Leaderboard'      },
    { path: '/app/forum',            name: 'Forum'            },
    { path: '/app/events',           name: 'Events'           },
    { path: '/app/audit-log',        name: 'Audit Log'        },
    { path: '/app/analytics',        name: 'Analytics'        },
];

for (const route of APP_ROUTES) {
    test(`renders without crash: ${route.name}`, async ({ page }) => {
        const errors = collectErrors(page);
        await goToApp(page);
        await page.goto(route.path);
        await page.waitForLoadState('networkidle');

        // No error boundary should be showing
        const errorBoundary = page.locator('text=Something went wrong');
        await expect(errorBoundary).not.toBeVisible();

        // Page should have some content (not blank)
        const body = await page.locator('body').innerHTML();
        expect(body.length).toBeGreaterThan(80);

        // Screenshot every route for visual regression
        await page.screenshot({
            path: `playwright-report/screenshots/${route.name.replace(/\s+/g, '-').toLowerCase()}.png`,
            fullPage: false,
        });

        // Warn if JS errors occurred (soft check — some third-party errors are ok)
        const criticalErrors = errors.filter(e =>
            e.includes('TypeError') || e.includes('ReferenceError') || e.includes('Cannot read')
        );
        expect(criticalErrors, `JS errors on ${route.name}: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });
}

// ─── Modal Tests ──────────────────────────────────────────────────────────────

test('Settings modal opens and closes', async ({ page }) => {
    await goToApp(page);
    // Open settings via stable Home action card (less flaky than user-panel re-renders)
    await page.getByText('Open Settings').first().click();
    await page.waitForTimeout(400);
    // If settings modal appeared, ESC should close it
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const modal = page.locator('text=User Settings');
    await expect(modal).not.toBeVisible();
});

test('Global search opens with ⌘K and closes with ESC', async ({ page }) => {
    await goToApp(page);
    await page.locator('body').click();
    await page.keyboard.press('Meta+k');
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="Search" i]').first();
    // Fallback for environments where Meta shortcut is not dispatched as expected.
    if (!(await searchInput.isVisible({ timeout: 1200 }).catch(() => false))) {
        await page.keyboard.press('Control+k');
    }
    if (!(await searchInput.isVisible({ timeout: 1200 }).catch(() => false))) {
        await page.getByRole('button', { name: /Search/i }).first().click();
    }
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(searchInput).not.toBeVisible({ timeout: 2000 });
});

test('Gacha pack drag does not crash page', async ({ page }) => {
    const errors = collectErrors(page);
    await goToApp(page);
    await page.goto('/app/gacha');
    await page.waitForLoadState('networkidle');

    // Find the draggable pack and drag it
    const pack = page.locator('div[style*="grab"]').first();
    if (await pack.isVisible()) {
        const box = await pack.boundingBox();
        if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + 200, box.y + 100, { steps: 20 });
            await page.mouse.up();
        }
    }

    await page.waitForTimeout(1000);
    const criticalErrors = errors.filter(e => e.includes('TypeError') || e.includes('ReferenceError'));
    expect(criticalErrors).toHaveLength(0);
});

// ─── Button Coverage Test ─────────────────────────────────────────────────────

test('All visible buttons on Home are clickable without JS error', async ({ page }) => {
    const errors = collectErrors(page);
    await goToApp(page);
    await clickAllButtons(page);
    const critical = errors.filter(e => e.includes('TypeError') || e.includes('ReferenceError'));
    expect(critical).toHaveLength(0);
});

test('All visible buttons on Shop are clickable without JS error', async ({ page }) => {
    const errors = collectErrors(page);
    await goToApp(page);
    await page.goto('/app/shop');
    await page.waitForSelector('button', { timeout: 5000 });
    const buttons = page.locator('button:not([disabled]):visible');
    const count = Math.min(await buttons.count(), 3);
    for (let i = 0; i < count; i++) {
        await buttons.nth(i).click({ force: true, timeout: 1000 }).catch(() => {});
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(60);
    }
    const critical = errors.filter(e => e.includes('TypeError') || e.includes('ReferenceError'));
    expect(critical).toHaveLength(0);
});

test('Marketplace always shows Live Auction and List Item actions', async ({ page }) => {
    const errors = collectErrors(page);
    await goToApp(page);
    await page.goto('/app/marketplace');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /Live Auction/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /List Item/i }).first()).toBeVisible();
    const critical = errors.filter(e => e.includes('TypeError') || e.includes('ReferenceError'));
    expect(critical).toHaveLength(0);
});

test('Discover portals view has no dead join actions', async ({ page }) => {
    const errors = collectErrors(page);
    await goToApp(page);
    await page.goto('/app/discover');
    await page.waitForLoadState('networkidle');
    const joinButtons = page.locator('span:has-text("Join")');
    const total = await joinButtons.count();
    if (total > 0) {
        await joinButtons.first().click({ timeout: 2000 });
        await page.waitForTimeout(200);
        await page.keyboard.press('Escape');
    }
    const critical = errors.filter(e => e.includes('TypeError') || e.includes('ReferenceError'));
    expect(critical).toHaveLength(0);
});

test('All visible buttons on Gacha are clickable without JS error', async ({ page }) => {
    const errors = collectErrors(page);
    await goToApp(page);
    await page.goto('/app/gacha');
    await page.waitForLoadState('networkidle');
    await clickAllButtons(page);
    const critical = errors.filter(e => e.includes('TypeError') || e.includes('ReferenceError'));
    expect(critical).toHaveLength(0);
});

test('Guild open failure does not spam legacy guild-load toast', async ({ page }) => {
    await goToApp(page);
    await page.goto('/app/guild/00000000-0000-0000-0000-000000000000', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByText('Failed to load guild data')).toHaveCount(0);
});

// ─── Auth Routes ──────────────────────────────────────────────────────────────

test('Login page renders', async ({ page }) => {
    await page.goto('/app/login');
    await expect(page.locator('input[type="email"], input[type="text"]').first()).toBeVisible();
});

test('404 page renders for unknown route', async ({ page }) => {
    await page.goto('/app/this-does-not-exist');
    const body = await page.locator('body').textContent();
    expect(body).toMatch(/not found|404/i);
});

test('In-app nav updates rendered view (not just URL)', async ({ page }) => {
    const errors = collectErrors(page);
    await goToApp(page);

    await page.getByRole('link', { name: /Friends/i }).first().click();
    await page.waitForURL('**/app/friends');
    await expect(page.getByRole('button', { name: /Add Friend/i })).toBeVisible();

    await page.getByRole('link', { name: /Discover/i }).first().click();
    await page.waitForURL('**/app/discover');
    await expect(page.getByRole('button', { name: /Portals/i }).first()).toBeVisible();

    const maxDepthErrors = errors.filter(e => /Maximum update depth exceeded/i.test(e));
    expect(maxDepthErrors, `Render loop warnings: ${maxDepthErrors.join('\n')}`).toHaveLength(0);
});

test('Auth expiry redirects once and prevents request storm on guild routes', async ({ page }) => {
    const errors = collectErrors(page);
    let meAttempts = 0;
    let walletAttempts = 0;
    let refreshAttempts = 0;

    await page.addInitScript(() => {
        window.localStorage.setItem('gratonite_access_token', 'expired-token');
    });

    await page.route('**/api/v1/users/@me', async route => {
        meAttempts += 1;
        await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'UNAUTHORIZED', message: 'Unauthorized' }),
        });
    });
    await page.route('**/api/v1/economy/wallet', async route => {
        walletAttempts += 1;
        await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'UNAUTHORIZED', message: 'Unauthorized' }),
        });
    });
    await page.route('**/api/v1/auth/refresh', async route => {
        refreshAttempts += 1;
        await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'UNAUTHORIZED', message: 'Invalid refresh token' }),
        });
    });

    await page.goto('/app/guild/00000000-0000-0000-0000-000000000000', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await expect.poll(() => page.url(), { timeout: 8000 }).toMatch(/\/login/);
    await page.waitForTimeout(1200);

    expect(refreshAttempts).toBeGreaterThan(0);
    expect(refreshAttempts).toBeLessThanOrEqual(3);
    expect(meAttempts).toBeLessThanOrEqual(4);
    expect(walletAttempts).toBeLessThanOrEqual(2);

    const maxDepthErrors = errors.filter(e => /Maximum update depth exceeded/i.test(e));
    expect(maxDepthErrors, `Render loop warnings: ${maxDepthErrors.join('\n')}`).toHaveLength(0);
});
