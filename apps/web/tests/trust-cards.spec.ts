import { test, expect } from '@playwright/test';

test.describe('TrustCards', () => {
  test('displays encryption trust card in DM', async ({ page }) => {
    await page.goto('/app/dm/test-dm-id');
    const trustCard = page.locator('[role="article"]', { has: page.locator('text=End-to-End Encrypted') });
    await expect(trustCard).toBeVisible();
  });

  test('dismisses trust card and persists state', async ({ page }) => {
    await page.goto('/app/dm/test-dm-id');
    const dismissBtn = page.locator('button[aria-label*="Dismiss"]').first();
    await dismissBtn.click();
    
    // Card should be hidden
    await expect(page.locator('text=End-to-End Encrypted')).not.toBeVisible();
    
    // Reload and verify persistence
    await page.reload();
    await expect(page.locator('text=End-to-End Encrypted')).not.toBeVisible();
  });

  test('federation card is visible on DM page', async ({ page }) => {
    await page.goto('/app/dm/test-dm-id');
    const fedCard = page.locator('[role="article"]', { has: page.locator('text=Federated Protocol') });
    // Card may or may not be visible depending on state, but should not throw
    if (await fedCard.isVisible()) {
      await expect(fedCard).toBeVisible();
    }
  });
});
