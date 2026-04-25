import { test, expect, Page } from '@playwright/test';

test.describe('FirstRunChecklist', () => {
  test('renders checklist with 4 tasks', async ({ page }) => {
    await page.goto('/app/');
    const checklist = page.locator('[role="region"]', { has: page.locator('text=Welcome to Gratonite') });
    await expect(checklist).toBeVisible();
    await expect(page.locator('button:has-text("Send a message")')).toBeVisible();
    await expect(page.locator('button:has-text("Join a guild")')).toBeVisible();
    await expect(page.locator('button:has-text("Read a DM")')).toBeVisible();
    await expect(page.locator('button:has-text("Enable 2FA")')).toBeVisible();
  });

  test('marks task complete and updates progress', async ({ page }) => {
    await page.goto('/app/');
    await page.locator('button:has-text("Send a message")').click();
    await expect(page.locator('[aria-label="Mark \\"Send a message\\" as complete"]')).toHaveClass(/text-green/);
  });

  test('dismisses checklist and persists state', async ({ page }) => {
    await page.goto('/app/');
    await page.locator('button[aria-label="Dismiss checklist"]').click();
    await expect(page.locator('[role="region"]')).not.toBeVisible();
    
    // Reload page
    await page.reload();
    await expect(page.locator('[role="region"]')).not.toBeVisible();
  });
});
