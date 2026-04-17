import { test, expect, type Locator, type Page } from '@playwright/test';
import { CHANGELOG } from '../src/data/changelog';

const apiHealthUrl = process.env.SMOKE_API_HEALTH_URL || 'https://api.gratonite.chat/health';
const smokeEmail = process.env.SMOKE_EMAIL;
const smokePassword = process.env.SMOKE_PASSWORD;
const smokeGuildId = process.env.SMOKE_GUILD_ID;
const smokeChatChannelId = process.env.SMOKE_CHAT_CHANNEL_ID;
const smokeForumChannelId = process.env.SMOKE_FORUM_CHANNEL_ID;
const runId = process.env.SMOKE_RUN_ID || `${Date.now()}`;
const smokePrefix = `[smoke:${runId}]`;
const latestChangelogId = CHANGELOG[0]?.id ?? '';

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
    await page.waitForFunction(() => Boolean(window.localStorage.getItem('gratonite_access_token')), undefined, {
        timeout: 30000,
    });
    await expect(page.locator('body')).toContainText(/Gratonite|Home|Friends|Discover/i, { timeout: 30000 });
}

async function prepareSmokeSession(page: Page) {
    const result = await page.evaluate(async ({ changelogId, chatChannelId, forumChannelId }) => {
        window.localStorage.setItem('gratonite_tour_complete', '1');
        window.localStorage.setItem('gratonite:last-seen-changelog', changelogId);
        window.localStorage.removeItem(`gratonite:draft:${chatChannelId}`);
        window.localStorage.removeItem(`gratonite:draft:${forumChannelId}`);

        const token = window.localStorage.getItem('gratonite_access_token');
        if (!token) {
            return { ok: false, status: null };
        }

        const profileResponse = await fetch('/api/v1/users/@me', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
            body: JSON.stringify({ onboardingCompleted: true }),
        });

        const draftResponses = await Promise.all([
            fetch(`/api/v1/channels/${chatChannelId}/draft`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include',
            }),
            fetch(`/api/v1/channels/${forumChannelId}/draft`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include',
            }),
        ]);

        return {
            ok: profileResponse.ok && draftResponses.every((response) => response.ok),
            status: profileResponse.status,
            draftStatuses: draftResponses.map((response) => response.status),
        };
    }, {
        changelogId: latestChangelogId,
        chatChannelId: smokeChatChannelId,
        forumChannelId: smokeForumChannelId,
    });

    expect(
        result.ok,
        `Expected smoke session prep to succeed, got profile status ${result.status ?? 'missing-token'} and draft statuses ${result.draftStatuses?.join(',') ?? 'none'}`,
    ).toBeTruthy();
}

async function clickViaDom(locator: Locator) {
    await locator.evaluate((element: Element) => {
        (element as HTMLElement).click();
    });
}

async function sendChatMessage(page: Page, messageText: string) {
    const messageLog = page.getByRole('log', { name: /messages in #smoke-chat/i });
    const messageInput = page.getByLabel(/message input/i);
    const sendButton = page.getByRole('button', { name: /send message/i });

    for (let attempt = 0; attempt < 2; attempt += 1) {
        await messageInput.fill(messageText);
        await expect(messageInput).toHaveValue(messageText);
        await clickViaDom(sendButton);

        try {
            await expect(messageLog).toContainText(messageText, { timeout: 15000 });
            return;
        } catch (error) {
            if (attempt === 1) {
                throw error;
            }
        }
    }
}

async function dismissOptionalOnboarding(page: Page) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
        let dismissed = false;

        const closeWhatsNewButton = page.getByRole('button', { name: /close what's new/i }).first();
        if (await closeWhatsNewButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await closeWhatsNewButton.click();
            dismissed = true;
        }

        const skipTourButton = page.getByRole('button', { name: /skip tour/i }).first();
        if (await skipTourButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await skipTourButton.click();
            dismissed = true;
        }

        const gotItButton = page.getByRole('button', { name: /^got it$/i }).first();
        if (await gotItButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await clickViaDom(gotItButton);
            dismissed = true;
        }

        if (!dismissed) {
            break;
        }

        await page.waitForTimeout(250);
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
        test.setTimeout(180000);

        await login(page);
        await prepareSmokeSession(page);
        await dismissOptionalOnboarding(page);

        const messageText = `${smokePrefix} text message`;
        await page.goto(`/app/guild/${smokeGuildId}/channel/${smokeChatChannelId}`);
        await dismissOptionalOnboarding(page);
        await expect(page.getByRole('log', { name: /messages in #smoke-chat/i })).toBeVisible({ timeout: 30000 });
        await sendChatMessage(page, messageText);

        const postTitle = `${smokePrefix} forum image post`;
        await page.goto(`/app/guild/${smokeGuildId}/channel/${smokeForumChannelId}`);
        await dismissOptionalOnboarding(page);
        await expect(page.locator('body')).toContainText(/No posts yet|Create a new post|smoke-forum/i, { timeout: 30000 });
        await clickViaDom(page.getByRole('button', { name: /new post|create first post/i }).first());
        await page.getByPlaceholder(/post title/i).fill(postTitle);
        await page.getByTestId('forum-create-file-input').setInputFiles(imageUploadFile(`forum-${runId}.png`));
        await clickViaDom(page.getByRole('button', { name: /^post$/i }));
        await expect(page.locator('body')).toContainText(postTitle, { timeout: 60000 });
        await expect(page.locator('img[alt*="forum-"], img[src*="/files/"], img[src*="/uploads/"]').first()).toBeVisible({ timeout: 60000 });

        const replyText = `${smokePrefix} image reply`;
        await page.getByPlaceholder(/write a reply/i).fill(replyText);
        await page.getByTestId('forum-reply-file-input').setInputFiles(imageUploadFile(`forum-reply-${runId}.png`));
        await clickViaDom(page.getByRole('button', { name: /send reply/i }));
        await expect(page.locator('body')).toContainText(replyText, { timeout: 60000 });

        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
        const searchInput = page.locator('input[placeholder*="search" i]').first();
        await expect(searchInput).toBeVisible({ timeout: 5000 });
        await searchInput.fill(messageText);
        await expect(page.locator('body')).toContainText(messageText, { timeout: 60000 });
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: /notifications inbox/i }).click();
        await expect(page.getByRole('dialog', { name: /notifications/i })).toBeVisible({ timeout: 10000 });
        await page.keyboard.press('Escape');

        await page.goto(`/app/guild/${smokeGuildId}/overview`);
        await expect(page.locator('body')).not.toBeEmpty();
    });
});
