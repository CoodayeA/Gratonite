import { expect, test } from '@playwright/test';
import { authenticateWithToken, createGuildWithChannels, registerUser } from './helpers';

async function normalizeForSnapshots(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
}

test.describe('visual baselines', () => {
  test('home, channel, and settings surfaces remain visually stable', async ({ page, request }) => {
    const owner = await registerUser(request, 'visual');
    const scope = await createGuildWithChannels(request, owner.token, {
      textChannels: ['snapshot-room'],
    });

    await page.addInitScript(() => {
      localStorage.setItem('ui_v2_tokens', '1');
    });
    await authenticateWithToken(page, owner.token);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/');
    await normalizeForSnapshots(page);
    await expect(page.locator('.home-page')).toHaveScreenshot('visual-home.png', {
      maxDiffPixelRatio: 0.015,
    });

    const targetChannel = scope.textChannels.find((channel) => channel.name === 'snapshot-room');
    await page.goto(`/guild/${scope.guildId}/channel/${targetChannel?.id ?? scope.generalChannelId}`);
    await normalizeForSnapshots(page);
    await expect(page.locator('.app-layout')).toHaveScreenshot('visual-channel-shell.png', {
      maxDiffPixelRatio: 0.015,
    });

    const uploader = page.locator('input[type="file"]');
    await uploader.setInputFiles({
      name: `visual-composer-${Date.now()}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from('composer visual state'),
    });
    await expect(page.locator('.attachment-preview-item-compact')).toHaveCount(1);
    await expect(page.locator('.message-composer')).toHaveScreenshot('visual-composer-attachment.png', {
      maxDiffPixelRatio: 0.015,
    });

    await page.goto('/settings');
    await normalizeForSnapshots(page);
    await expect(page.locator('.settings-page')).toHaveScreenshot('visual-settings.png', {
      maxDiffPixelRatio: 0.015,
    });
  });

  test('appearance visual presets update root visual data attributes', async ({ page, request }) => {
    const owner = await registerUser(request, 'visualpreset');
    await page.addInitScript(() => {
      localStorage.setItem('ui_v2_tokens', '1');
    });
    await authenticateWithToken(page, owner.token);
    await page.goto('/settings');

    const appearanceNav = page.locator('.settings-nav-item').filter({ hasText: 'Appearance' }).first();
    await expect(appearanceNav).toBeVisible();
    await appearanceNav.click();
    await expect(page.getByRole('button', { name: 'Immersive' })).toBeVisible();
    await page.getByRole('button', { name: 'Immersive' }).click();

    await expect
      .poll(async () =>
        page.evaluate(() => ({
          glass: document.documentElement.dataset.themeGlass,
          surface: document.documentElement.dataset.uiSurfaceBackground,
          scrim: document.documentElement.dataset.uiContentScrim,
          portal: document.documentElement.dataset.uiPortalBg,
          channel: document.documentElement.dataset.uiChannelBg,
          dm: document.documentElement.dataset.uiDmBg,
          lowPower: document.documentElement.dataset.uiLowPower,
          reduced: document.documentElement.dataset.uiReducedEffects,
        })),
      )
      .toEqual({
        glass: 'full',
        surface: 'full',
        scrim: 'soft',
        portal: 'aurora',
        channel: 'mesh',
        dm: 'aurora',
        lowPower: 'false',
        reduced: 'false',
      });

    await page.getByRole('button', { name: 'Performance' }).click();
    await expect
      .poll(async () =>
        page.evaluate(() => ({
          glass: document.documentElement.dataset.themeGlass,
          surface: document.documentElement.dataset.uiSurfaceBackground,
          scrim: document.documentElement.dataset.uiContentScrim,
          lowPower: document.documentElement.dataset.uiLowPower,
          reduced: document.documentElement.dataset.uiReducedEffects,
        })),
      )
      .toEqual({
        glass: 'off',
        surface: 'contained',
        scrim: 'strong',
        lowPower: 'true',
        reduced: 'true',
      });
  });
});
