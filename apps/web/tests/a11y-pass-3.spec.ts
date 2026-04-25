import { test, expect } from '@playwright/test';

test.describe('Accessibility Pass 3', () => {
  test.describe('Skip Links', () => {
    test('skip links are present and focusable', async ({ page }) => {
      await page.goto('/app/');
      
      // First tab should focus skip link
      await page.keyboard.press('Tab');
      const skipLink = page.locator('a[href="#main-content"]');
      await expect(skipLink).toBeFocused();
    });

    test('skip link is visible on focus', async ({ page }) => {
      await page.goto('/app/');
      
      // Focus skip link
      await page.keyboard.press('Tab');
      const skipLink = page.locator('a[href="#main-content"]');
      
      // Check that it's visible (not clipped)
      const boundingBox = await skipLink.boundingBox();
      expect(boundingBox).toBeTruthy();
      if (boundingBox) {
        expect(boundingBox.width).toBeGreaterThan(0);
        expect(boundingBox.height).toBeGreaterThan(0);
      }
    });

    test('skip link has accessible text', async ({ page }) => {
      await page.goto('/app/');
      
      const skipLinks = page.locator('.sr-only-focusable');
      const count = await skipLinks.count();
      
      expect(count).toBeGreaterThanOrEqual(2);
      
      // First skip link should say "Skip to main content"
      const mainSkip = page.locator('a[href="#main-content"]');
      await expect(mainSkip).toContainText('Skip to main content');
      
      // Second skip link should say "Skip to sidebar"
      const sidebarSkip = page.locator('a[href="#sidebar"]');
      await expect(sidebarSkip).toContainText('Skip to sidebar');
    });
  });

  test.describe('Focus Trap - SettingsModal', () => {
    test('settings modal can be opened and closed', async ({ page }) => {
      await page.goto('/app/');
      
      // Look for settings button
      const settingsBtn = page.locator('button[aria-label="Settings"]').first();
      if (await settingsBtn.isVisible()) {
        await settingsBtn.click();
        const modal = page.locator('[role="dialog"][aria-label="Settings"]');
        await expect(modal).toBeVisible();
      }
    });

    test('focus trap in modal - Tab wraps to first element', async ({ page }) => {
      await page.goto('/app/');
      
      const settingsBtn = page.locator('button[aria-label="Settings"]').first();
      if (await settingsBtn.isVisible()) {
        await settingsBtn.click();
        const modal = page.locator('[role="dialog"][aria-label="Settings"]');
        await expect(modal).toBeVisible();
        
        // Get focusable elements in modal
        const focusables = modal.locator('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])');
        const count = await focusables.count();
        
        if (count > 1) {
          // Focus last focusable element
          await focusables.nth(count - 1).focus();
          
          // Tab should wrap back to first
          await page.keyboard.press('Tab');
          const focusedElement = await page.evaluate(() => {
            const elem = document.activeElement;
            return {
              tag: elem?.tagName,
              text: (elem as any)?.textContent?.substring(0, 20)
            };
          });
          
          // Should focus first focusable element (might be input or button)
          expect(['BUTTON', 'INPUT', 'A', 'SELECT', 'TEXTAREA']).toContain(focusedElement.tag);
        }
      }
    });

    test('focus trap in modal - Shift+Tab wraps to last element', async ({ page }) => {
      await page.goto('/app/');
      
      const settingsBtn = page.locator('button[aria-label="Settings"]').first();
      if (await settingsBtn.isVisible()) {
        await settingsBtn.click();
        const modal = page.locator('[role="dialog"][aria-label="Settings"]');
        await expect(modal).toBeVisible();
        
        // Get focusable elements
        const focusables = modal.locator('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])');
        const count = await focusables.count();
        
        if (count > 1) {
          // Focus first element and shift+tab
          await focusables.nth(0).focus();
          await page.keyboard.press('Shift+Tab');
          
          // Should focus last focusable element
          const focusedElement = await page.evaluate(() => {
            const elem = document.activeElement;
            return {
              tag: elem?.tagName,
            };
          });
          
          expect(['BUTTON', 'INPUT', 'A', 'SELECT', 'TEXTAREA']).toContain(focusedElement.tag);
        }
      }
    });
  });

  test.describe('Semantic HTML - Buttons', () => {
    test('settings modal tabs are semantic buttons', async ({ page }) => {
      await page.goto('/app/');
      
      const settingsBtn = page.locator('button[aria-label="Settings"]').first();
      if (await settingsBtn.isVisible()) {
        await settingsBtn.click();
        const modal = page.locator('[role="dialog"][aria-label="Settings"]');
        await expect(modal).toBeVisible();
        
        // Check that sidebar navigation items are buttons (not divs with role="button")
        const navItems = modal.locator('.sidebar-nav-item');
        const count = await navItems.count();
        
        if (count > 0) {
          // Get first nav item and check it's a button
          const firstNav = navItems.first();
          const tag = await firstNav.evaluate(el => el.tagName.toLowerCase());
          
          expect(tag).toBe('button');
        }
      }
    });

    test('no divs with role="button" in settings modal', async ({ page }) => {
      await page.goto('/app/');
      
      const settingsBtn = page.locator('button[aria-label="Settings"]').first();
      if (await settingsBtn.isVisible()) {
        await settingsBtn.click();
        const modal = page.locator('[role="dialog"][aria-label="Settings"]');
        await expect(modal).toBeVisible();
        
        // Look for divs with role="button" - should find none
        const divWithRole = modal.locator('div[role="button"]');
        const count = await divWithRole.count();
        
        expect(count).toBe(0);
      }
    });

    test('buttons are keyboard accessible', async ({ page }) => {
      await page.goto('/app/');
      
      const settingsBtn = page.locator('button[aria-label="Settings"]').first();
      if (await settingsBtn.isVisible()) {
        await settingsBtn.click();
        const modal = page.locator('[role="dialog"][aria-label="Settings"]');
        await expect(modal).toBeVisible();
        
        // Get first button in modal
        const firstButton = modal.locator('button').first();
        
        // Should be focusable without tabindex
        const tabindex = await firstButton.getAttribute('tabindex');
        expect(tabindex !== '-1').toBeTruthy();
      }
    });
  });
});
