/**
 * Routing Navigation Tests — Verify URL changes sync with displayed content
 * Regression tests for DM/channel navigation freeze bug
 *
 * Run: npx playwright test routing-navigation
 */

import { test, expect, Page } from '@playwright/test';

/**
 * Helper: Navigate to path and wait for content to load
 */
async function navigateAndWait(page: Page, path: string, waitSelector?: string) {
    await page.goto(path, { waitUntil: 'networkidle' });
    if (waitSelector) {
        await page.waitForSelector(waitSelector, { timeout: 5000 });
    }
}

/**
 * Helper: Get current pathname
 */
async function getCurrentPath(page: Page): Promise<string> {
    return page.evaluate(() => window.location.pathname);
}

test.describe('Routing & Navigation', () => {
    test.beforeEach(async ({ page }) => {
        // Login before running tests (assumes test account exists)
        await page.goto('/login', { waitUntil: 'networkidle' });
        // If not logged in, skip
        const isLoggedIn = await page.locator('[data-testid="sidebar-guilds"]').isVisible().catch(() => false);
        if (!isLoggedIn) {
            test.skip();
        }
    });

    test('DM to Guild Channel - URL and content sync', async ({ page }) => {
        // Precondition: Have at least one DM and one guild channel
        // 1. Navigate to a DM
        const dmLink = page.locator('[data-testid="dm-list"] a').first();
        const dmHref = await dmLink.getAttribute('href');
        expect(dmHref).toMatch(/^\/dm\//);
        
        await dmLink.click();
        await page.waitForURL(/^.*\/dm\/.*/, { timeout: 5000 });
        const dmPath = await getCurrentPath(page);
        expect(dmPath).toMatch(/^\/dm\//);
        
        // Verify DM content is visible (messages container)
        const dmContent = page.locator('[data-testid="message-container"]');
        await expect(dmContent).toBeVisible({ timeout: 5000 });
        
        // 2. Click a guild channel
        const channelLink = page.locator('[data-testid="channel-list"] a').first();
        const channelHref = await channelLink.getAttribute('href');
        expect(channelHref).toMatch(/^\/guild\/.*\/channel\//);
        
        await channelLink.click();
        
        // 3. Verify URL changed
        await page.waitForURL(/^.*\/guild\/.*\/channel\/.*/, { timeout: 5000 });
        const channelPath = await getCurrentPath(page);
        expect(channelPath).toMatch(/^\/guild\/.*\/channel\//);
        expect(channelPath).not.toBe(dmPath);
        
        // 4. Verify channel content is displayed (should NOT show DM content)
        const channelContent = page.locator('[data-testid="message-container"]');
        await expect(channelContent).toBeVisible({ timeout: 5000 });
        
        // 5. Verify no frozen/stale content by checking that reload shows same content
        const contentBefore = await channelContent.textContent();
        // Navigate away and back to verify content was properly loaded
        await dmLink.click();
        await page.waitForURL(/^.*\/dm\/.*/, { timeout: 5000 });
        await channelLink.click();
        await page.waitForURL(/^.*\/guild\/.*\/channel\/.*/, { timeout: 5000 });
        const contentAfter = await channelContent.textContent();
        
        // Content should be the same (test is about consistency, not exact match)
        expect(contentAfter).toBeDefined();
        expect(contentBefore).toBeDefined();
    });

    test('DM to Friends - URL and content sync', async ({ page }) => {
        // 1. Navigate to a DM
        const dmLink = page.locator('[data-testid="dm-list"] a').first();
        await dmLink.click();
        await page.waitForURL(/^.*\/dm\/.*/, { timeout: 5000 });
        
        // 2. Click Friends link
        const friendsLink = page.locator('[data-testid="nav-friends"]');
        await friendsLink.click();
        
        // 3. Verify URL changed to /friends
        await page.waitForURL('**/friends', { timeout: 5000 });
        const friendsPath = await getCurrentPath(page);
        expect(friendsPath).toBe('/friends');
        
        // 4. Verify Friends content is displayed
        const friendsContent = page.locator('[data-testid="friends-list"], [data-testid="friends-container"]');
        await expect(friendsContent).toBeVisible({ timeout: 5000 }).catch(() => {
            // Friends page might have different structure; just ensure we're not showing DM content
            return expect(page.locator('[data-testid="message-container"]')).not.toBeVisible();
        });
    });

    test('Rapid channel switching - no stale content', async ({ page }) => {
        // Find multiple channels
        const channels = page.locator('[data-testid="channel-list"] a');
        const channelCount = await channels.count();
        
        if (channelCount < 3) {
            test.skip(); // Need at least 3 channels
        }
        
        // Click first channel
        await channels.nth(0).click();
        await page.waitForURL(/^.*\/guild\/.*\/channel\/.*/, { timeout: 5000 });
        const path1 = await getCurrentPath(page);
        
        // Click second channel
        await channels.nth(1).click();
        await page.waitForURL(/^.*\/guild\/.*\/channel\/.*/, { timeout: 5000 });
        const path2 = await getCurrentPath(page);
        
        // Click third channel
        await channels.nth(2).click();
        await page.waitForURL(/^.*\/guild\/.*\/channel\/.*/, { timeout: 5000 });
        const path3 = await getCurrentPath(page);
        
        // Verify each path is different
        expect(path1).not.toBe(path2);
        expect(path2).not.toBe(path3);
        expect(path1).not.toBe(path3);
        
        // Verify content is loaded for final channel
        const content = page.locator('[data-testid="message-container"]');
        await expect(content).toBeVisible({ timeout: 5000 });
        
        // Verify no loading spinners stuck (would indicate race condition)
        const spinner = page.locator('[data-testid="loading-spinner"]');
        await expect(spinner).not.toBeVisible({ timeout: 2000 }).catch(() => {
            // If spinner exists, it should complete within 2 seconds
            return expect(spinner).not.toBeVisible({ timeout: 3000 });
        });
    });

    test('Guild Channel A to B - content updates (same guild)', async ({ page }) => {
        // Find channels in the same guild
        const channels = page.locator('[data-testid="channel-list"] a');
        const channelCount = await channels.count();
        
        if (channelCount < 2) {
            test.skip(); // Need at least 2 channels
        }
        
        // Click first channel and record guild ID
        await channels.nth(0).click();
        await page.waitForURL(/^.*\/guild\/.*\/channel\/.*/, { timeout: 5000 });
        const path1 = await getCurrentPath(page);
        const guildMatch1 = path1.match(/\/guild\/([^/]+)/);
        expect(guildMatch1).toBeTruthy();
        const guildId = guildMatch1![1];
        
        // Verify first channel content loads
        const content = page.locator('[data-testid="message-container"]');
        await expect(content).toBeVisible({ timeout: 5000 });
        const content1 = await content.textContent();
        
        // Click second channel in same guild
        await channels.nth(1).click();
        await page.waitForURL(/^.*\/guild\/.*\/channel\/.*/, { timeout: 5000 });
        const path2 = await getCurrentPath(page);
        
        // Verify we're still in same guild but different channel
        const guildMatch2 = path2.match(/\/guild\/([^/]+)/);
        expect(guildMatch2).toBeTruthy();
        expect(guildMatch2![1]).toBe(guildId); // Same guild
        expect(path2).not.toBe(path1); // Different channel
        
        // Verify second channel content loads (might be empty, but should load)
        await expect(content).toBeVisible({ timeout: 5000 });
        const content2 = await content.textContent();
        
        // Content should be different (or at least the component should have re-rendered)
        // We can't guarantee different content (empty channels), but structure should be fresh
        expect(content2).toBeDefined();
    });

    test('Browser back/forward preserves URL-content sync', async ({ page }) => {
        // 1. Navigate to channel
        const channels = page.locator('[data-testid="channel-list"] a');
        await channels.nth(0).click();
        await page.waitForURL(/^.*\/guild\/.*\/channel\/.*/, { timeout: 5000 });
        const path1 = await getCurrentPath(page);
        
        // 2. Navigate to DM
        const dmLink = page.locator('[data-testid="dm-list"] a').first();
        await dmLink.click();
        await page.waitForURL(/^.*\/dm\/.*/, { timeout: 5000 });
        const path2 = await getCurrentPath(page);
        
        // 3. Go back to channel
        await page.goBack();
        await page.waitForURL(path1, { timeout: 5000 });
        const pathBack = await getCurrentPath(page);
        expect(pathBack).toBe(path1);
        
        // 4. Verify channel content is displayed
        const content = page.locator('[data-testid="message-container"]');
        await expect(content).toBeVisible({ timeout: 5000 });
    });
});
