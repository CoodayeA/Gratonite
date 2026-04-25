import { expect, test, type Page } from '@playwright/test';

async function mockShellApi(page: Page) {
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

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    let body: unknown = [];

    if (path === '/users/@me') body = mockUser;
    else if (path === '/users/@me/settings') body = {};
    else if (path === '/users/@me/guild-folders') body = [];
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
  });

  test('classic UI remains available as the fallback', async ({ page }) => {
    await page.goto('/app/');
    await page.evaluate(() => localStorage.setItem('gratonite:ui-experience', 'classic'));
    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.locator('html')).toHaveAttribute('data-ui-experience', 'classic');
    await expect(page.locator('html')).not.toHaveClass(/gt-new-ui/);
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
});
