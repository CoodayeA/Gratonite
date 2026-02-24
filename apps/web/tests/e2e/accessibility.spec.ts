import { expect, test } from '@playwright/test';
import { authenticateWithToken, createGuildWithChannels, registerUser } from './helpers';

function parseRgb(input: string) {
  const match = input.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1]!.split(',').map((p) => p.trim());
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b };
}

function luminance(rgb: { r: number; g: number; b: number }) {
  const norm = [rgb.r, rgb.g, rgb.b].map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * norm[0]! + 0.7152 * norm[1]! + 0.0722 * norm[2]!;
}

function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

test('portal gallery controls expose pressed state and keyboard entry works', async ({ page, request }) => {
  const owner = await registerUser(request, 'a11y');
  const scope = await createGuildWithChannels(request, owner.token, {
    textChannels: ['welcome-room'],
  });

  await page.addInitScript(() => {
    localStorage.setItem('ui_v2_tokens', '1');
  });
  await authenticateWithToken(page, owner.token);
  await page.goto('/');

  const gallery = page.locator('.server-gallery');
  await expect(gallery).toBeVisible();

  const fillButton = page.getByRole('button', { name: 'Fill cards' });
  const fitButton = page.getByRole('button', { name: 'Fit media' });
  await expect(fillButton).toHaveAttribute('aria-pressed', 'true');
  await fitButton.click();
  await expect(fitButton).toHaveAttribute('aria-pressed', 'true');

  const firstCard = page.locator('.server-gallery-card').first();
  await firstCard.focus();
  await expect(firstCard).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/guild/${scope.guildId}/channel/`));
});

test('portal gallery supports keyboard-only navigation across controls and cards', async ({ page, request }) => {
  const owner = await registerUser(request, 'a11ykeys');
  const scope = await createGuildWithChannels(request, owner.token, {
    textChannels: ['keyboard-room'],
  });

  await page.addInitScript(() => {
    localStorage.setItem('ui_v2_tokens', '1');
  });
  await authenticateWithToken(page, owner.token);
  await page.goto('/');

  const fillButton = page.getByRole('button', { name: 'Fill cards' });
  const fitButton = page.getByRole('button', { name: 'Fit media' });
  const animatedToggle = page.getByRole('button', { name: /Animated banners (on|off)/ });
  const firstCard = page.locator('.server-gallery-card').first();

  await fillButton.focus();
  await expect(fillButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(fitButton).toBeFocused();
  await page.keyboard.press('Space');
  await expect(fitButton).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Tab');
  await expect(animatedToggle).toBeFocused();
  const beforePressed = await animatedToggle.getAttribute('aria-pressed');
  await page.keyboard.press('Enter');
  const afterPressed = await animatedToggle.getAttribute('aria-pressed');
  expect(beforePressed).not.toEqual(afterPressed);

  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    if (await firstCard.evaluate((el) => el === document.activeElement)) {
      break;
    }
  }
  await expect(firstCard).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/guild/${scope.guildId}/channel/`));
});

test('reduced motion styles apply and key text contrast remains readable', async ({ page, request }) => {
  const owner = await registerUser(request, 'a11yproof');
  const scope = await createGuildWithChannels(request, owner.token, { textChannels: ['contrast-room'] });

  await page.addInitScript(() => {
    localStorage.setItem('ui_v2_tokens', '1');
  });
  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.generalChannelId}`);
  await page.evaluate(() => {
    document.documentElement.dataset.themeMotion = 'reduced';
  });

  const transitionDuration = await page.locator('.channel-item').first().evaluate((el) => {
    return window.getComputedStyle(el).transitionDuration;
  });
  const parsedMs = Number.parseFloat(transitionDuration);
  expect(Number.isFinite(parsedMs)).toBeTruthy();
  expect(parsedMs).toBeLessThanOrEqual(0.02);

  const sample = await page.evaluate(() => {
    const body = window.getComputedStyle(document.body);
    const shell = document.querySelector('.app-layout');
    const shellStyles = shell ? window.getComputedStyle(shell) : null;
    return {
      text: body.color,
      bg: shellStyles?.backgroundColor ?? body.backgroundColor,
    };
  });

  const fg = parseRgb(sample.text);
  const bg = parseRgb(sample.bg);
  expect(fg).not.toBeNull();
  expect(bg).not.toBeNull();
  const ratio = contrastRatio(fg!, bg!);
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});
