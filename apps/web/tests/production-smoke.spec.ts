import { test, expect, type Page } from '@playwright/test';

const apiHealthUrl = process.env.SMOKE_API_HEALTH_URL || 'https://api.gratonite.chat/health';
const smokeEmail = process.env.SMOKE_EMAIL;
const smokePassword = process.env.SMOKE_PASSWORD;
const smokeGuildId = process.env.SMOKE_GUILD_ID;
const smokeChatChannelId = process.env.SMOKE_CHAT_CHANNEL_ID;
const smokeForumChannelId = process.env.SMOKE_FORUM_CHANNEL_ID;
const runId = process.env.SMOKE_RUN_ID || `${Date.now()}`;
const smokePrefix = `[smoke:${runId}]`;

const hasAuthenticatedSmokeConfig = Boolean(
    smokeEmail
    && smokePassword
    && smokeGuildId
    && smokeChatChannelId
    && smokeForumChannelId,
);

async function login(page: Page) {
    await page.goto('/app/login');
    await page.getByPlaceholder(/email or username/i).fill(smokeEmail!);
    await page.getByPlaceholder(/password/i).fill(smokePassword!);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/\/app(\/|$)/, { timeout: 30000 });
    await expect(page.locator('body')).toContainText(/Gratonite|Home|Friends|Discover/i, { timeout: 30000 });
}

async function dismissOptionalOnboarding(page: Page) {
    const skipTourButton = page.getByRole('button', { name: /skip tour/i }).first();
    if (await skipTourButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await skipTourButton.click();
    }
}

function imageUploadFile(name: string) {
    return {
        name,
        mimeType: 'image/png',
        buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
            'base64',
        ),
    };
}

test('public production surfaces are healthy', async ({ page, request }) => {
    const health = await request.get(apiHealthUrl);
    expect(health.ok(), `Expected ${apiHealthUrl} to return a 2xx response`).toBeTruthy();

    await page.goto('/app/');
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page).toHaveTitle(/Gratonite/i);

    await page.goto('/releases');
    await expect(page.locator('body')).toContainText(/What's New|Release|Forum/i);
});

test.describe('authenticated production critical flows', () => {
    test.skip(!hasAuthenticatedSmokeConfig, 'Set SMOKE_EMAIL, SMOKE_PASSWORD, SMOKE_GUILD_ID, SMOKE_CHAT_CHANNEL_ID, and SMOKE_FORUM_CHANNEL_ID to enable authenticated production smoke.');

    test('chat, forum upload, search, notifications, and settings do not regress', async ({ page }) => {
        await login(page);
        await dismissOptionalOnboarding(page);

        const messageText = `${smokePrefix} text message`;
        await page.goto(`/app/guild/${smokeGuildId}/channel/${smokeChatChannelId}`);
        await page.getByLabel(/message input/i).fill(messageText);
        await page.getByRole('button', { name: /send message/i }).click();
        await expect(page.locator('body')).toContainText(messageText, { timeout: 30000 });

        const postTitle = `${smokePrefix} forum image post`;
        await page.goto(`/app/guild/${smokeGuildId}/channel/${smokeForumChannelId}`);
        await page.getByRole('button', { name: /new post/i }).click();
        await page.getByPlaceholder(/post title/i).fill(postTitle);
        await page.getByTestId('forum-create-file-input').setInputFiles(imageUploadFile(`forum-${runId}.png`));
        await page.getByRole('button', { name: /^post$/i }).click();
        await expect(page.locator('body')).toContainText(postTitle, { timeout: 30000 });
        await expect(page.locator('img[alt*="forum-"], img[src*="/files/"], img[src*="/uploads/"]').first()).toBeVisible({ timeout: 30000 });

        const replyText = `${smokePrefix} image reply`;
        await page.getByPlaceholder(/write a reply/i).fill(replyText);
        await page.getByTestId('forum-reply-file-input').setInputFiles(imageUploadFile(`forum-reply-${runId}.png`));
        await page.getByRole('button', { name: /send reply/i }).click();
        await expect(page.locator('body')).toContainText(replyText, { timeout: 30000 });

        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
        const searchInput = page.locator('input[placeholder*="search" i]').first();
        await expect(searchInput).toBeVisible({ timeout: 5000 });
        await searchInput.fill(messageText);
        await expect(page.locator('body')).toContainText(messageText, { timeout: 30000 });
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: /notifications inbox/i }).click();
        await expect(page.getByRole('dialog', { name: /notifications/i })).toBeVisible({ timeout: 10000 });
        await page.keyboard.press('Escape');

        await page.goto(`/app/guild/${smokeGuildId}/overview`);
        await expect(page.locator('body')).not.toBeEmpty();
    });
});
