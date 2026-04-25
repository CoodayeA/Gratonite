import { expect, test, type Page } from '@playwright/test';

async function mockCoreSurfaceApi(page: Page) {
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
    } else if (path === '/inventory') body = { items: [] };
    else if (path === '/shop/items') body = [];
    else if (path === '/cosmetics/marketplace') body = [];
    else if (path === '/auctions' || path === '/auctions/me/selling' || path === '/auctions/me/bids') body = [];
    else if (path === '/cards/collection' || path === '/cards/packs') body = [];
    else if (path === '/economy/ledger') body = [];
    else if (path.includes('/unread') || path.includes('/count')) body = { count: 0, total: 0 };
    else if (route.request().method() !== 'GET') body = { success: true };

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.route('**/gacha/gacha_manifest.json', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

async function openFriendsWithExperience(page: Page, experience: 'classic' | 'premium-gamer-os') {
  await page.addInitScript((value) => {
    localStorage.setItem('gratonite:ui-experience', value);
    localStorage.setItem('gratonite_tour_complete', '1');
  }, experience);
  await page.goto('/app/friends', { waitUntil: 'networkidle' });
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 10_000 });
}

async function openAppRouteWithExperience(page: Page, route: string, experience: 'classic' | 'premium-gamer-os') {
  await page.addInitScript((value) => {
    localStorage.setItem('gratonite:ui-experience', value);
    localStorage.setItem('gratonite_tour_complete', '1');
  }, experience);
  await page.goto(route, { waitUntil: 'networkidle' });
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 10_000 });
}

async function openDmWithExperience(page: Page, experience: 'classic' | 'premium-gamer-os') {
  await page.addInitScript((value) => {
    localStorage.setItem('gratonite:ui-experience', value);
    localStorage.setItem('gratonite_tour_complete', '1');
  }, experience);
  await page.goto('/app/');
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 10_000 });

  const dm = page.locator('a[href*="/dm/"]').first();
  await expect(dm, 'fixture requires at least one DM').toBeVisible({ timeout: 10_000 });
  await dm.click();
  await page.waitForURL(/\/dm\//);
}

test.describe('New UI core chat surfaces', () => {
  test.beforeEach(async ({ page }) => {
    await mockCoreSurfaceApi(page);
  });

  test('premium UI persists on a DM route and keeps chat/composer visible', async ({ page }) => {
    await openDmWithExperience(page, 'premium-gamer-os');

    await expect(page.locator('html')).toHaveAttribute('data-ui-experience', 'premium-gamer-os');
    await expect(page.locator('html')).toHaveClass(/gt-new-ui/);
    await expect(page.locator('[data-ui-chat-surface][data-ui-chat-kind="dm"]')).toBeVisible();
    await expect(page.locator('[data-ui-message-list]')).toBeVisible();
    await expect(page.locator('[data-ui-composer]')).toBeVisible();

    const input = page.getByRole('textbox', { name: /message input/i });
    await input.fill('premium smoke');
    await expect(input).toHaveValue('premium smoke');
    await expect(page.getByRole('button', { name: /send message/i })).toBeEnabled();
  });

  test('premium UI keeps DM file attachment affordance available', async ({ page }) => {
    await openDmWithExperience(page, 'premium-gamer-os');

    await expect(page.locator('input#dm-file-upload[type="file"]')).toHaveCount(1);
    await expect(page.locator('[data-ui-upload-affordance]')).toBeVisible();
  });

  test('settings modal still opens under premium UI from a DM route', async ({ page }) => {
    await openDmWithExperience(page, 'premium-gamer-os');

    await page.getByTestId('settings-btn').click();
    await expect(page.getByRole('dialog', { name: /settings/i })).toBeVisible();
  });

  test('premium UI keeps friends tabs and add friend action visible', async ({ page }) => {
    await openFriendsWithExperience(page, 'premium-gamer-os');

    await expect(page.locator('html')).toHaveAttribute('data-ui-experience', 'premium-gamer-os');
    await expect(page.locator('[data-ui-social-surface]')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Online$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^All$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Pending/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add Friend/ })).toBeVisible();
  });

  test('premium UI renders commerce routes inside the app shell', async ({ page }) => {
    const routes = [
      { path: '/app/shop', surface: 'shop', heading: /Cosmetics Shop/i },
      { path: '/app/marketplace', surface: 'marketplace', heading: /Community Marketplace/i },
      { path: '/app/inventory', surface: 'inventory', heading: /Inventory & Loadout/i },
      { path: '/app/gacha', surface: 'gacha', heading: /Gratonite Guys Gacha/i },
    ];

    for (const route of routes) {
      await openAppRouteWithExperience(page, route.path, 'premium-gamer-os');

      await expect(page.locator('html')).toHaveAttribute('data-ui-experience', 'premium-gamer-os');
      await expect(page.locator('html')).toHaveClass(/gt-new-ui/);
      await expect(page.locator('.app-container')).toBeVisible();
      await expect(page.locator(`[data-ui-commerce-surface="${route.surface}"]`)).toBeVisible();
      await expect(page.getByText(route.heading).first()).toBeVisible();
    }
  });

  test('classic fallback remains available on a DM route', async ({ page }) => {
    await openDmWithExperience(page, 'classic');

    await expect(page.locator('html')).toHaveAttribute('data-ui-experience', 'classic');
    await expect(page.locator('html')).not.toHaveClass(/gt-new-ui/);
    await expect(page.locator('[data-ui-chat-surface][data-ui-chat-kind="dm"]')).toBeVisible();
    await expect(page.locator('[data-ui-composer]')).toBeVisible();
  });
});
