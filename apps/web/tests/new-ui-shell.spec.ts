import { expect, test, type Page } from '@playwright/test';

async function mockShellApi(page: Page) {
  const mockFriend = {
    id: 'friend-user',
    username: 'friend',
    displayName: 'Friendly Gamer',
    avatarHash: null,
    status: 'online',
  };
  const mockUser = {
    id: 'e2e-user',
    username: 'e2e',
    email: 'e2e@example.com',
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    isAdmin: false,
    status: 'online',
    onboardingCompleted: true,
    interests: [],
    profile: {
      displayName: 'E2E User',
      avatarHash: null,
      bannerHash: null,
      bio: null,
      pronouns: null,
      avatarDecorationId: null,
      profileEffectId: null,
      nameplateId: null,
      tier: 'free',
      previousAvatarHashes: [],
      messageCount: 0,
    },
  };
  const mockDmChannel = {
    id: 'dm-channel-1',
    name: 'dm-e2e-user-friend-user',
    type: 'DM',
    recipients: [mockFriend],
  };

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    let body: unknown = [];

    if (path === '/users/@me') body = mockUser;
    else if (path === '/users/friend-user') body = mockFriend;
    else if (path === '/users/presences') body = [{ userId: mockFriend.id, status: 'online', updatedAt: '2024-01-01T00:00:00.000Z', lastSeen: null }];
    else if (path === '/users') body = [mockUser, mockFriend];
    else if (path === '/users/@me/settings') body = {};
    else if (path === '/users/@me/guild-folders') body = [];
    else if (path === '/guilds/@me') body = [];
    else if (path === '/relationships') body = [{
      id: 'rel-1',
      type: 'FRIEND',
      user: mockFriend,
      friend: mockFriend,
      recipient: mockFriend,
    }];
    else if (path === '/relationships/channels') body = [mockDmChannel];
    else if (path === '/relationships/groups') body = [];
    else if (path === '/friend-suggestions') body = [];
    else if (path === '/referrals/@me') body = {};
    else if (path === '/channels/dm-channel-1') body = mockDmChannel;
    else if (path === '/channels/dm-channel-1/messages') body = [];
    else if (path === '/channels/dm-channel-1/pins') body = [];
    else if (path === '/channels/dm-channel-1/call-history') body = [];
    else if (path === '/channels/dm-channel-1/draft') body = {};
    else if (path === '/channels/dm-channel-1/messages/scheduled') body = [];
    else if (path === '/users/friend-user/profile') body = {
      displayName: mockFriend.displayName,
      username: mockFriend.username,
      bannerHash: null,
      bio: null,
      pronouns: null,
      customStatus: null,
      statusEmoji: null,
      badges: [],
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    else if (path === '/users/friend-user/mutuals') body = { mutualServers: [], mutualFriends: [] };
    else if (path === '/users/friend-user/fame') body = { fameReceived: 0, fameGiven: 0 };
    else if (path === '/users/e2e-user/public-key' || path === '/users/friend-user/public-key') body = { publicKeyJwk: null, keyVersion: 1 };
    else if (path === '/economy/wallet') {
      body = { userId: mockUser.id, balance: 0, lifetimeEarned: 0, lifetimeSpent: 0, lastDailyClaimAt: null, updatedAt: '2024-01-01T00:00:00.000Z' };
    } else if (path.includes('/unread') || path.includes('/count')) body = { count: 0, total: 0 };
    else if (route.request().method() !== 'GET') body = { success: true };

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test.describe('New Gratonite UI opt-in', () => {
  test.beforeEach(async ({ page }) => {
    await mockShellApi(page);
  });

  test('can enable Premium Gamer OS experience and persist the root flag', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 10_000 });

    await page.evaluate(() => localStorage.setItem('gratonite:ui-experience', 'premium-gamer-os'));
    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.locator('html')).toHaveAttribute('data-ui-experience', 'premium-gamer-os');
    await expect(page.locator('html')).toHaveClass(/gt-new-ui/);
    await expect(page.locator('.app-container')).toHaveAttribute('data-ui-shell', 'premium');
  });

  test('classic UI remains available as the fallback', async ({ page }) => {
    await page.goto('/app/');
    await page.evaluate(() => localStorage.setItem('gratonite:ui-experience', 'classic'));
    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.locator('html')).toHaveAttribute('data-ui-experience', 'classic');
    await expect(page.locator('html')).not.toHaveClass(/gt-new-ui/);
    await expect(page.locator('.app-container')).toHaveAttribute('data-ui-shell', 'classic');
  });

  test('settings exposes the Premium Gamer OS opt-in toggle', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('settings-btn').click();
    const settingsDialog = page.getByRole('dialog', { name: /settings/i });
    await expect(settingsDialog).toBeVisible();
    await settingsDialog.getByRole('button', { name: /^Theme$/i }).click();

    const toggle = page.getByRole('checkbox', { name: /Enable Premium Gamer OS beta UI/i });
    await expect(toggle).toBeVisible();
    await toggle.check();
    await expect(page.locator('html')).toHaveAttribute('data-ui-experience', 'premium-gamer-os');
  });

  test('New UI preserves route navigation from DM to Friends', async ({ page }) => {
    await page.goto('/app/');
    await page.evaluate(() => localStorage.setItem('gratonite:ui-experience', 'premium-gamer-os'));
    await page.reload({ waitUntil: 'networkidle' });

    const dm = page.locator('a[href*="/dm/"]').first();
    await expect(dm, 'fixture requires at least one DM').toBeVisible({ timeout: 10_000 });
    await dm.click();
    await page.waitForURL(/\/dm\//);
    await expect(page.getByRole('log', { name: /^Direct messages with / })).toBeVisible();

    await page.locator('a[href="/friends"], a[href="/app/friends"]').first().click();
    await page.waitForURL(/\/friends/);
    await expect(page.getByRole('button', { name: 'Online' })).toBeVisible();
    await expect(page.getByRole('log', { name: /^Direct messages with / })).toHaveCount(0);
  });
});
