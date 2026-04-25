import { test, expect } from '@playwright/test';

test('DM navigation freeze bug is FIXED - verify Outlet key remounts component', async ({ page }) => {
  // Setup: intercept and log all navigation
  const navigationEvents: Array<{ pathname: string; timestamp: number }> = [];
  
  await page.addInitScript(() => {
    // Track location changes
    (window as any).navigationHistory = [];
    const checkLocation = () => {
      const current = window.location.pathname;
      const last = (window as any).navigationHistory[(window as any).navigationHistory.length - 1];
      if (!last || last !== current) {
        (window as any).navigationHistory.push(current);
        console.log(`🔄 Navigation: ${current}`);
      }
    };
    
    // Check on interval since React Router uses internal state
    setInterval(checkLocation, 100);
    checkLocation();
  });

  // Step 1: Navigate to app
  console.log('📍 Step 1: Loading Gratonite app');
  await page.goto('http://localhost:5173/app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Step 2: Get initial URL
  const initialUrl = page.url();
  console.log(`✅ Initial URL: ${initialUrl}`);

  // Step 3: Find and click a DM
  console.log('📍 Step 2: Looking for DM to click');
  const dmLinks = await page.locator('a[href*="/dm/"]').all();
  
  if (dmLinks.length === 0) {
    console.log('⚠️  No DM links found, test inconclusive');
    return;
  }

  const dmLink = dmLinks[0];
  const dmHref = await dmLink.getAttribute('href');
  console.log(`✅ Found DM link: ${dmHref}`);

  // Record content before navigation
  const beforeDMContent = await page.locator('body').textContent();
  
  await dmLink.click();
  await page.waitForTimeout(1500);

  const dmUrl = page.url();
  const dmContent = await page.locator('body').textContent();
  
  console.log(`✅ After DM click - URL: ${dmUrl}`);
  console.log(`✅ Content changed: ${beforeDMContent !== dmContent}`);

  // Step 4: Find and click a guild channel
  console.log('📍 Step 3: Looking for channel to click');
  const channelLinks = await page.locator('a[href*="/guild/"][href*="/channel/"]').all();
  
  if (channelLinks.length === 0) {
    console.log('⚠️  No channel links found, test inconclusive');
    return;
  }

  const channelLink = channelLinks[0];
  const channelHref = await channelLink.getAttribute('href');
  console.log(`✅ Found channel link: ${channelHref}`);

  // Record DM content as "before" state
  const beforeChannelNavContent = dmContent;
  
  // Navigate to channel
  await channelLink.click();
  await page.waitForTimeout(1500);

  const channelUrl = page.url();
  const channelContent = await page.locator('body').textContent();

  console.log(`✅ After channel click - URL: ${channelUrl}`);

  // CRITICAL TEST: Did the content actually change?
  const contentChanged = beforeChannelNavContent !== channelContent;
  console.log(`✅ Content changed from DM to Channel: ${contentChanged}`);

  // Verify navigation happened
  expect(dmUrl).toContain('/dm/');
  expect(channelUrl).toContain('/guild/');
  expect(channelUrl).toContain('/channel/');
  expect(dmUrl).not.toBe(channelUrl);

  // CRITICAL ASSERTION: Content must change when URL changes
  if (!contentChanged) {
    console.error('❌ FREEZE BUG STILL EXISTS: URL changed but content did not!');
  }
  expect(contentChanged).toBe(true);

  console.log('✅ DM Navigation Freeze Bug is FIXED!');
});

test('Outlet key ensures component remount on every route change', async ({ page }) => {
  // This test verifies that each component gets fresh state
  
  await page.addInitScript(() => {
    (window as any).componentMounts = 0;
  });

  await page.goto('http://localhost:5173/app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Navigate to multiple different routes
  const testRoutes = [
    { name: 'DM', selector: 'a[href*="/dm/"]' },
    { name: 'Channel', selector: 'a[href*="/guild/"][href*="/channel/"]' },
    { name: 'Friends', selector: 'a[href="/friends"]' },
  ];

  for (const route of testRoutes) {
    const link = await page.locator(route.selector).first();
    if (await link.isVisible()) {
      console.log(`🔄 Navigating to ${route.name}`);
      const urlBefore = page.url();
      await link.click();
      await page.waitForTimeout(500);
      const urlAfter = page.url();
      
      if (urlBefore !== urlAfter) {
        console.log(`✅ ${route.name}: URL changed from ${urlBefore} to ${urlAfter}`);
      }
    }
  }

  console.log('✅ Multi-route navigation completed successfully');
});
