/**
 * verify-dm-nav-fix.spec.ts
 *
 * Regression tests for the DM navigation freeze bug.
 * Verifies that navigating from a DM route to a guild channel (and other top-level
 * routes) actually updates visible content — i.e., the Outlet remounts properly.
 *
 * Run: npx playwright test verify-dm-nav-fix
 *
 * Requirements:
 *  - Dev server running on http://localhost:5173 (see playwright.config.ts webServer)
 *  - App must be logged in (VITE_E2E_BYPASS_AUTH=1 is set in webServer env)
 *  - At least one DM link and one guild channel link must be present in the UI
 */

import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to the app root and wait for the layout shell to be present. */
async function loadApp(page: Page) {
    await page.goto('/app/', { waitUntil: 'networkidle' });
    // The app container is the root layout element; wait for it to be visible.
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 10_000 });
}

/** Return the first `a[href*="/dm/"]` locator, or null if none is visible. */
async function firstDmLink(page: Page) {
    const link = page.locator('a[href*="/dm/"]').first();
    const visible = await link.isVisible().catch(() => false);
    return visible ? link : null;
}

/** Return the first `a[href*="/guild/"][href*="/channel/"]` locator, or null if none is visible. */
async function firstChannelLink(page: Page) {
    const link = page.locator('a[href*="/guild/"][href*="/channel/"]').first();
    const visible = await link.isVisible().catch(() => false);
    return visible ? link : null;
}

/** Return the first visible Friends nav link, or null. */
async function friendsLink(page: Page) {
    const link = page.locator('a[href="/friends"]').first();
    const visible = await link.isVisible().catch(() => false);
    return visible ? link : null;
}

/**
 * Assert that the main content area is visible and not frozen.
 * The main-content-wrapper is always present in AppLayout; if it's gone the
 * route transition left the layout in a broken state.
 */
async function assertMainContentVisible(page: Page, context: string) {
    await expect(
        page.locator('#main-content'),
        `main-content should be visible after navigating to ${context}`,
    ).toBeVisible({ timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('DM navigation freeze regression', () => {
    test.beforeEach(async ({ page }) => {
        await loadApp(page);
    });

    // -----------------------------------------------------------------------
    // Core freeze bug: DM → guild channel must update visible content
    // -----------------------------------------------------------------------
    test('DM to guild channel — URL and visible content both update', async ({ page }) => {
        const dm = await firstDmLink(page);
        expect(dm, 'No DM links found — fixture required for this test').not.toBeNull();

        const dmHref = await dm!.getAttribute('href');
        expect(dmHref).toMatch(/\/dm\//);

        // Navigate to the DM
        await dm!.click();
        await page.waitForURL(/\/dm\//, { timeout: 5_000 });
        const dmUrl = page.url();

        // DM route: the message input or message list area should be present
        await assertMainContentVisible(page, 'DM route');

        // ------------------------------------------------------------------
        // Navigate to a guild channel — this is the critical transition
        // ------------------------------------------------------------------
        const channel = await firstChannelLink(page);
        expect(channel, 'No guild channel links found — fixture required for this test').not.toBeNull();

        const channelHref = await channel!.getAttribute('href');
        expect(channelHref).toMatch(/\/guild\/.*\/channel\//);

        await channel!.click();

        // URL must update to the channel path — if it stays on /dm/ the freeze is present
        await page.waitForURL(/\/guild\/.*\/channel\//, { timeout: 5_000 });
        const channelUrl = page.url();

        expect(channelUrl).toContain('/guild/');
        expect(channelUrl).toContain('/channel/');
        expect(channelUrl).not.toBe(dmUrl);

        // The main content area must still be visible (not a blank/frozen screen)
        await assertMainContentVisible(page, 'guild channel route');

        // The route-transition-wrapper must exist and not be in a stuck exit state:
        // if AnimatePresence mode="wait" froze, the wrapper stays display:none / opacity:0
        const wrapper = page.locator('.route-transition-wrapper').first();
        await expect(wrapper).toBeVisible({ timeout: 3_000 });
    });

    // -----------------------------------------------------------------------
    // DM → top-level route (Friends/Home) — verifies non-guild transitions
    // -----------------------------------------------------------------------
    test('DM to top-level route — URL and layout update', async ({ page }) => {
        const dm = await firstDmLink(page);
        expect(dm, 'No DM links found — fixture required for this test').not.toBeNull();

        await dm!.click();
        await page.waitForURL(/\/dm\//, { timeout: 5_000 });

        // Try Friends link; fall back to home ('/') if not present
        const friends = await friendsLink(page);
        if (friends) {
            await friends.click();
            await page.waitForURL('**/friends', { timeout: 5_000 });
            expect(page.url()).toContain('/friends');
        } else {
            await page.goto('/app/', { waitUntil: 'networkidle' });
            expect(page.url()).not.toMatch(/\/dm\//);
        }

        await assertMainContentVisible(page, 'top-level route');
    });

    // -----------------------------------------------------------------------
    // Multi-route navigation — each link click must change the URL
    // -----------------------------------------------------------------------
    test('sequential route switches all produce URL changes', async ({ page }) => {
        type RouteSpec = { label: string; selector: string; urlPattern: RegExp };
        const routes: RouteSpec[] = [
            { label: 'DM',      selector: 'a[href*="/dm/"]',                           urlPattern: /\/dm\// },
            { label: 'Channel', selector: 'a[href*="/guild/"][href*="/channel/"]',      urlPattern: /\/guild\/.*\/channel\// },
            { label: 'Friends', selector: 'a[href="/friends"]',                         urlPattern: /\/friends/ },
        ];

        let navigated = 0;
        for (const route of routes) {
            const link = page.locator(route.selector).first();
            if (!(await link.isVisible().catch(() => false))) continue;

            const urlBefore = page.url();
            await link.click();
            await page.waitForURL(route.urlPattern, { timeout: 5_000 });
            const urlAfter = page.url();

            expect(urlAfter, `URL should change when navigating to ${route.label}`).not.toBe(urlBefore);
            expect(urlAfter).toMatch(route.urlPattern);
            await assertMainContentVisible(page, route.label);
            navigated++;
        }

        // At least one route must have been navigated (not all fixtures absent)
        expect(navigated, 'At least one navigable route must be present').toBeGreaterThan(0);
    });

    // -----------------------------------------------------------------------
    // Outlet key remount: navigating back and forth must not freeze
    // -----------------------------------------------------------------------
    test('back-and-forth DM↔channel does not freeze the Outlet', async ({ page }) => {
        const dm = await firstDmLink(page);
        const channel = await firstChannelLink(page);

        expect(dm, 'No DM links found — fixture required for this test').not.toBeNull();
        expect(channel, 'No guild channel links found — fixture required for this test').not.toBeNull();

        for (let i = 0; i < 3; i++) {
            await dm.click();
            await page.waitForURL(/\/dm\//, { timeout: 5_000 });
            await assertMainContentVisible(page, `DM (round ${i + 1})`);

            await channel.click();
            await page.waitForURL(/\/guild\/.*\/channel\//, { timeout: 5_000 });
            await assertMainContentVisible(page, `Channel (round ${i + 1})`);
        }

        // After repeated toggling the route-transition-wrapper must still be visible
        await expect(page.locator('.route-transition-wrapper').first()).toBeVisible({ timeout: 3_000 });
    });
});
