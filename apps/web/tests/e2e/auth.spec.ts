import { expect, test } from '@playwright/test';

function unique(prefix: string) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

test('registers a new account from the web UI', async ({ page }) => {
  const username = unique('webuser');
  const email = `${username}@test.local`;

  await page.goto('/register');

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Display Name').fill('Web E2E');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill('TestPass123!');
  await page.getByLabel('Date of Birth').fill('2000-01-01');

  await page.getByRole('button', { name: 'Continue' }).click();

  const uiError = page.locator('.auth-error');
  if (await uiError.isVisible()) {
    const message = await uiError.textContent();
    throw new Error(`register UI error: ${message ?? 'unknown'}`);
  }

  await expect(page).not.toHaveURL(/\/register$/);
  await expect.poll(async () => {
    return page.evaluate(() => localStorage.getItem('gratonite_access_token'));
  }).toBeTruthy();
});

test('logs in with existing account and restores session on reload', async ({ page, request }) => {
  const username = unique('loginuser');
  const email = `${username}@test.local`;

  const registerRes = await request.post('http://127.0.0.1:4000/api/v1/auth/register', {
    data: {
      username,
      email,
      password: 'TestPass123!',
      displayName: 'Login User',
      dateOfBirth: '2000-01-01',
    },
  });
  if (!registerRes.ok()) {
    throw new Error(`register seed failed: status=${registerRes.status()} body=${await registerRes.text()}`);
  }

  await page.goto('/login');
  await page.getByLabel('Email or Username').fill(username);
  await page.getByLabel('Password').fill('TestPass123!');
  await page.getByRole('button', { name: 'Log In' }).click();

  await expect(page).not.toHaveURL(/\/login$/);
  await expect.poll(async () => {
    return page.evaluate(() => localStorage.getItem('gratonite_access_token'));
  }).toBeTruthy();

  await page.reload();
  await expect(page).not.toHaveURL(/\/login$/);
});
