import { test, expect } from '@playwright/test';

test('DM navigation freeze bug - detailed debugging', async ({ page, context }) => {
  // Intercept console messages
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Enable detailed logging
  await page.addInitScript(() => {
    (window as any).navigationLogs = [];
    
    const originalNavigate = window.history.pushState;
    window.history.pushState = function(...args) {
      (window as any).navigationLogs.push({
        timestamp: new Date().toISOString(),
        action: 'pushState',
        pathname: args[2]
      });
      return originalNavigate.apply(window.history, args);
    };
    
    // Log when React mounts/unmounts
    console.log('🚀 Navigation test started');
  });

  // Navigate to the app
  console.log('📍 Step 1: Navigating to app...');
  await page.goto('http://localhost:5173/app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Get current URL
  const url1 = page.url();
  console.log(`📍 Current URL: ${url1}`);

  // Try to navigate to a DM (if we can find one in the UI)
  console.log('📍 Step 2: Looking for DM to click...');
  const dmLink = await page.locator('a[href*="/dm/"]').first();
  if (await dmLink.isVisible()) {
    const dmHref = await dmLink.getAttribute('href');
    console.log(`✅ Found DM link: ${dmHref}`);
    
    // Record the state before click
    await page.addInitScript(() => {
      (window as any).beforeNavigation = {
        url: window.location.pathname,
        timestamp: Date.now()
      };
    });
    
    await dmLink.click();
    await page.waitForTimeout(1000);
    
    const dmUrl = page.url();
    console.log(`📍 After DM click: ${dmUrl}`);

    // Now try to click a guild/channel
    console.log('📍 Step 3: Looking for channel to click...');
    const channelLink = await page.locator('a[href*="/guild/"][href*="/channel/"]').first();
    if (await channelLink.isVisible()) {
      const channelHref = await channelLink.getAttribute('href');
      console.log(`✅ Found channel link: ${channelHref}`);
      
      await channelLink.click();
      await page.waitForTimeout(1000);
      
      const channelUrl = page.url();
      console.log(`📍 After channel click: ${channelUrl}`);
      
      // Check if content changed
      const hasTitle = await page.locator('h1, h2, [class*="title"]').first().isVisible();
      console.log(`✅ Page title visible: ${hasTitle}`);
    }
  }

  // Extract navigation logs
  const navLogs = await page.evaluate(() => (window as any).navigationLogs);
  console.log('Navigation history:', navLogs);
  console.log('Console logs:', consoleLogs);
});
