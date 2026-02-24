import { expect, test } from '@playwright/test';
import { authenticateWithToken, createGuildAndTextChannel, createGuildWithChannels, openDmChannel, postWithRateLimitRetry, registerUser } from './helpers';

const API_BASE = `${(process.env['PW_API_ORIGIN'] ?? 'http://127.0.0.1:4000').replace(/\/+$/, '')}/api/v1`;

test('sends a message in guild channel and persists after refresh', async ({ page, request }) => {
  const user = await registerUser(request, 'msguser');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  const composer = page.locator('.message-composer-input');
  await expect(composer).toBeVisible();

  const text = `web-e2e message ${Date.now()}`;
  await composer.fill(text);
  await composer.press('Enter');

  const sentMessage = page.locator('.message-content', { hasText: text }).last();
  await expect(sentMessage).toBeVisible();

  await page.reload();
  await expect(page.locator('.message-content', { hasText: text }).last()).toBeVisible();
});

test('sends a message in guild channel via send button', async ({ page, request }) => {
  const user = await registerUser(request, 'msgbtn');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  const composer = page.locator('.message-composer-input');
  await expect(composer).toBeVisible();

  const text = `web-e2e button send ${Date.now()}`;
  await composer.fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.locator('.message-content', { hasText: text }).last()).toBeVisible();
});

test('edits and deletes an existing message via context actions', async ({ page, request }) => {
  const user = await registerUser(request, 'edituser');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  const composer = page.locator('.message-composer-input');
  await expect(composer).toBeVisible();

  const original = `web-e2e original ${Date.now()}`;
  await composer.fill(original);
  await composer.press('Enter');

  const originalMessage = page.locator('.message-content', { hasText: original }).last();
  await expect(originalMessage).toBeVisible();

  const originalMessageItem = originalMessage.locator('xpath=ancestor::div[contains(@class,"message-item")]').first();
  await originalMessageItem.hover();
  await originalMessageItem.locator('.message-action-btn[title="Edit"]').click();

  const editInput = page.locator('.message-edit-input').last();
  const edited = `${original} edited`;
  await editInput.fill(edited);
  await editInput.press('Enter');

  const editedMessage = page.locator('.message-content', { hasText: edited }).last();
  await expect(editedMessage).toBeVisible();

  const editedMessageItem = editedMessage.locator('xpath=ancestor::div[contains(@class,"message-item")]').first();
  await editedMessageItem.hover();
  await editedMessageItem.locator('.message-action-btn[title="Delete"]').click();

  const modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Delete' }).click();

  await expect(page.locator('.message-content', { hasText: edited })).toHaveCount(0);
});

test('uploads an attachment and sends it in a message', async ({ page, request }) => {
  const user = await registerUser(request, 'attachuser');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  const uploader = page.locator('input[type="file"]');
  await expect(uploader).toBeAttached();

  const filename = `e2e-attachment-${Date.now()}.txt`;
  await uploader.setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from('attachment smoke test'),
  });

  await expect(page.locator('.attachment-preview-item-compact')).toHaveCount(1);
  await page.locator('.message-composer-input').press('Enter');

  await expect(page.locator('.attachment-file-name', { hasText: filename }).last()).toBeVisible();
});

test('uploads attachment with non-loopback URL shape', async ({ page, request }) => {
  const user = await registerUser(request, 'imguser');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  const uploader = page.locator('input[type="file"]');
  await expect(uploader).toBeAttached();

  const filename = `e2e-attachment-${Date.now()}.txt`;
  await uploader.setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from('attachment url safety smoke test'),
  });

  await expect(page.locator('.attachment-preview-item-compact')).toHaveCount(1);
  await page.locator('.message-composer-input').press('Enter');

  await expect(page.locator('.attachment-file-name', { hasText: filename }).last()).toBeVisible();
  const attachmentLink = page.locator('.attachment-file').last();
  await expect(attachmentLink).toBeVisible();
  const href = await attachmentLink.getAttribute('href');
  expect(href).not.toContain('localhost');
  expect(href).not.toContain('127.0.0.1');
  expect(href).toContain('/api/v1/files/');
});

test('keeps attachment URL shape safe on mobile viewport in DM', async ({ page, request }) => {
  const sender = await registerUser(request, 'mobattachsender');
  const recipient = await registerUser(request, 'mobattachrecv');
  const dmId = await openDmChannel(request, sender.token, recipient.userId);

  await page.setViewportSize({ width: 390, height: 844 });
  await authenticateWithToken(page, sender.token);
  await page.goto(`/dm/${dmId}`);

  const uploader = page.locator('input[type="file"]');
  await expect(uploader).toBeAttached();

  const filename = `mobile-attachment-${Date.now()}.txt`;
  await uploader.setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from('mobile attachment url safety smoke'),
  });

  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.attachment-file-name', { hasText: filename }).last()).toBeVisible();
  const attachmentLink = page.locator('.attachment-file').last();
  await expect(attachmentLink).toBeVisible();
  const href = await attachmentLink.getAttribute('href');
  expect(href).not.toContain('localhost');
  expect(href).not.toContain('127.0.0.1');
  expect(href).toContain('/api/v1/files/');
});

test('keeps composer attachment preview usable on mobile with many attachments', async ({ page, request }) => {
  const user = await registerUser(request, 'mobattachstrip');
  const scope = await createGuildAndTextChannel(request, user.token);

  await page.setViewportSize({ width: 390, height: 844 });
  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  const uploader = page.locator('input[type="file"]');
  await expect(uploader).toBeAttached();

  await uploader.setInputFiles([
    { name: `a-${Date.now()}.txt`, mimeType: 'text/plain', buffer: Buffer.from('a') },
    { name: `b-${Date.now()}.txt`, mimeType: 'text/plain', buffer: Buffer.from('b') },
    { name: `c-${Date.now()}.txt`, mimeType: 'text/plain', buffer: Buffer.from('c') },
    { name: `d-${Date.now()}.txt`, mimeType: 'text/plain', buffer: Buffer.from('d') },
  ]);

  await expect(page.locator('.attachment-preview-item-compact')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();

  const previewStrip = page.locator('.attachment-preview-items');
  await expect(previewStrip).toBeVisible();
  const metrics = await previewStrip.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeGreaterThanOrEqual(metrics.clientWidth);
});

test('mobile composer keeps send button reachable with multiline text and attachments', async ({ page, request }) => {
  const user = await registerUser(request, 'mobmultisend');
  const scope = await createGuildAndTextChannel(request, user.token);

  await page.setViewportSize({ width: 390, height: 844 });
  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  const composer = page.locator('.message-composer-input');
  await expect(composer).toBeVisible();
  await composer.fill(`Line one ${Date.now()}\nLine two\nLine three`);

  const uploader = page.locator('input[type="file"]');
  await uploader.setInputFiles([
    { name: `m1-${Date.now()}.txt`, mimeType: 'text/plain', buffer: Buffer.from('m1') },
    { name: `m2-${Date.now()}.txt`, mimeType: 'text/plain', buffer: Buffer.from('m2') },
  ]);

  const sendButton = page.getByRole('button', { name: 'Send message' });
  await expect(sendButton).toBeVisible();
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(page.locator('.message-content', { hasText: 'Line one' }).last()).toBeVisible();
});

async function resetNotificationsUiState(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    try {
      localStorage.removeItem('notifications_ui_state_v1');
      localStorage.removeItem('notifications_filter_v1');
    } catch {
      // ignore storage access issues in tests
    }
  });
}

function notificationsSection(
  page: import('@playwright/test').Page,
  title: 'Mentions' | 'Unread Conversations' | 'Incoming Friend Requests',
) {
  return page.locator('.notifications-panel').filter({
    has: page.locator('.notifications-section-title', { hasText: title }),
  });
}

test('notifications clear mentions action dismisses mention cards', async ({ page, request }) => {
  const user = await registerUser(request, 'notifmention');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);
  await expect(page.locator('.channel-page')).toBeVisible();

  await resetNotificationsUiState(page);
  await page.goto('/notifications');
  await page.evaluate((channelId) => {
    window.__gratoniteHarness?.clearUnread();
    window.__gratoniteHarness?.markMention(channelId, 3);
  }, scope.channelId);
  await page.getByRole('button', { name: /^Mentions/ }).first().click();
  const mentionsPanel = notificationsSection(page, 'Mentions');
  await expect(mentionsPanel).toBeVisible();
  await expect(mentionsPanel.locator('.notifications-item')).toHaveCount(1);
  await mentionsPanel.getByRole('button', { name: /Clear mentions|Clear visible/i }).first().click();
  await expect(page.locator('.notifications-empty', { hasText: 'No unread mentions right now.' })).toBeVisible();
});

test('notifications clear unread action dismisses unread cards', async ({ page, request }) => {
  const user = await registerUser(request, 'notifunread');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);
  await expect(page.locator('.channel-page')).toBeVisible();

  await resetNotificationsUiState(page);
  await page.goto('/notifications');
  await page.evaluate((channelId) => {
    window.__gratoniteHarness?.clearUnread();
    window.__gratoniteHarness?.markUnread(channelId, 2);
  }, scope.channelId);
  await page.getByRole('button', { name: /^Unread/ }).first().click();
  const unreadPanel = notificationsSection(page, 'Unread Conversations');
  await expect(unreadPanel).toBeVisible();
  await unreadPanel.getByRole('button', { name: /Clear unread|Clear visible/i }).first().click();
  await expect(page.locator('.notifications-empty', { hasText: 'No unread activity right now.' })).toBeVisible();
});

test('notifications per-item dismiss removes mention card', async ({ page, request }) => {
  const user = await registerUser(request, 'notifdismissm');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  await resetNotificationsUiState(page);
  await page.goto('/notifications');
  await page.evaluate((channelId) => {
    window.__gratoniteHarness?.clearUnread();
    window.__gratoniteHarness?.markMention(channelId, 1);
  }, scope.channelId);
  await page.getByRole('button', { name: /^Mentions/ }).first().click();
  const mentionsPanel = notificationsSection(page, 'Mentions');
  const mentionCard = mentionsPanel.locator('.notifications-item').first();
  await expect(mentionCard).toBeVisible();
  await expect(page.locator('.notifications-section-title', { hasText: 'Mentions' })).toBeVisible();
  await mentionsPanel.getByRole('button', { name: 'Dismiss' }).first().click();
  await expect(page.locator('.notifications-empty', { hasText: 'No unread mentions right now.' })).toBeVisible();
});

test('notifications per-item dismiss removes unread card', async ({ page, request }) => {
  const user = await registerUser(request, 'notifdismissu');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  await resetNotificationsUiState(page);
  await page.goto('/notifications');
  await page.evaluate((channelId) => {
    window.__gratoniteHarness?.clearUnread();
    window.__gratoniteHarness?.markUnread(channelId, 2);
  }, scope.channelId);
  await page.getByRole('button', { name: /^Unread/ }).first().click();
  await expect(page.locator('.notifications-section-title', { hasText: 'Unread Conversations' })).toBeVisible();
  const unreadPanel = notificationsSection(page, 'Unread Conversations');
  await unreadPanel.getByRole('button', { name: /Mark read|Dismiss/i }).first().click();
  await expect(page.locator('.notifications-empty', { hasText: 'No unread activity right now.' })).toBeVisible();
});

test('notifications sections collapse and expand with persisted state', async ({ page, request }) => {
  const user = await registerUser(request, 'notifcollapse');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);
  await page.evaluate((channelId) => {
    window.__gratoniteHarness?.clearUnread();
    window.__gratoniteHarness?.markUnread(channelId, 1);
    window.__gratoniteHarness?.markMention(channelId, 1);
  }, scope.channelId);

  await resetNotificationsUiState(page);
  await page.goto('/notifications');
  await page.locator('.notifications-panel').filter({ hasText: 'Mentions' }).getByRole('button', { name: 'Collapse', exact: true }).click();
  await page.locator('.notifications-panel').filter({ hasText: 'Unread Conversations' }).getByRole('button', { name: 'Collapse', exact: true }).click();
  await page.reload();

  await expect(page.locator('.notifications-panel').filter({ hasText: 'Mentions' }).getByRole('button', { name: 'Expand', exact: true })).toBeVisible();
  await expect(page.locator('.notifications-panel').filter({ hasText: 'Unread Conversations' }).getByRole('button', { name: 'Expand', exact: true })).toBeVisible();
});

test('notifications collapse state persists across filter switches', async ({ page, request }) => {
  const user = await registerUser(request, 'notiffilterpersist');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);
  await page.evaluate((channelId) => {
    window.__gratoniteHarness?.clearUnread();
    window.__gratoniteHarness?.markMention(channelId, 1);
    window.__gratoniteHarness?.markUnread(channelId, 1);
  }, scope.channelId);

  await resetNotificationsUiState(page);
  await page.goto('/notifications');
  const mentionsPanel = page.locator('.notifications-panel').filter({ hasText: 'Mentions' });
  await mentionsPanel.getByRole('button', { name: 'Collapse', exact: true }).click();
  await page.getByRole('button', { name: /Unread/i }).first().click();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(mentionsPanel.getByRole('button', { name: 'Expand', exact: true })).toBeVisible();
});

test('notifications selected filter persists across reload', async ({ page, request }) => {
  const user = await registerUser(request, 'notiffilterreload');
  await authenticateWithToken(page, user.token);
  await resetNotificationsUiState(page);
  await page.goto('/notifications');

  await page.getByRole('button', { name: /^Friend Requests/i }).click();
  await page.reload();

  await expect(page.getByRole('button', { name: /^Friend Requests/i }).first()).toHaveClass(/active/);
  await expect(page.locator('.notifications-section-title', { hasText: 'Incoming Friend Requests' })).toBeVisible();
});

test('notifications reset view clears persisted filter and collapsed state', async ({ page, request }) => {
  const user = await registerUser(request, 'notifresetview');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);
  await page.evaluate((channelId) => {
    window.__gratoniteHarness?.clearUnread();
    window.__gratoniteHarness?.markUnread(channelId, 3);
    window.__gratoniteHarness?.markMention(channelId, 2);
  }, scope.channelId);

  await resetNotificationsUiState(page);
  await page.goto('/notifications');

  await page.locator('.notifications-panel').filter({ hasText: 'Mentions' }).getByRole('button', { name: 'Collapse', exact: true }).click();
  await page.locator('.notifications-panel').filter({ hasText: 'Unread Conversations' }).getByRole('button', { name: 'Collapse', exact: true }).click();
  await page.locator('.notifications-filter-row').getByRole('button', { name: /^Mentions/i }).click();
  await expect(page.locator('.notifications-filter-row').getByRole('button', { name: /^Mentions/i })).toHaveClass(/active/);
  await page.reload();

  await expect(page.getByRole('button', { name: /^Mentions/i }).first()).toHaveClass(/active/);
  await expect(page.locator('.notifications-panel').filter({ hasText: 'Mentions' }).getByRole('button', { name: 'Expand', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveClass(/active/);
  await expect(page.locator('.notifications-panel').filter({ hasText: 'Mentions' }).getByRole('button', { name: 'Collapse', exact: true })).toBeVisible();
  await expect(page.locator('.notifications-panel').filter({ hasText: 'Unread Conversations' }).getByRole('button', { name: 'Collapse', exact: true })).toBeVisible();

  const persisted = await page.evaluate(() => ({
    filter: localStorage.getItem('notifications_filter_v1'),
    ui: localStorage.getItem('notifications_ui_state_v1'),
  }));
  expect(persisted.filter).toBe('all');
  expect(persisted.ui).toContain('"mentionsCollapsed":false');
  expect(persisted.ui).toContain('"unreadCollapsed":false');
});

test('notifications collapse all and expand all control all sections', async ({ page, request }) => {
  const user = await registerUser(request, 'notifcollapseall');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);
  await page.evaluate((channelId) => {
    window.__gratoniteHarness?.clearUnread();
    window.__gratoniteHarness?.markUnread(channelId, 2);
    window.__gratoniteHarness?.markMention(channelId, 1);
  }, scope.channelId);

  await resetNotificationsUiState(page);
  await page.goto('/notifications');

  await page.getByRole('button', { name: 'Collapse all' }).click();
  await expect(page.locator('.notifications-panel').filter({ hasText: 'Incoming Friend Requests' }).getByRole('button', { name: 'Expand', exact: true })).toBeVisible();
  await expect(page.locator('.notifications-panel').filter({ hasText: 'Mentions' }).getByRole('button', { name: 'Expand', exact: true })).toBeVisible();
  await expect(page.locator('.notifications-panel').filter({ hasText: 'Unread Conversations' }).getByRole('button', { name: 'Expand', exact: true })).toBeVisible();
  await expect(page.getByText('All sections collapsed')).toBeVisible();

  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(page.locator('.notifications-panel').filter({ hasText: 'Mentions' }).getByRole('button', { name: 'Collapse', exact: true })).toBeVisible();
  await expect(page.locator('.notifications-panel').filter({ hasText: 'Unread Conversations' }).getByRole('button', { name: 'Collapse', exact: true })).toBeVisible();
});

test('notifications clear visible respects active filter and resets unread state', async ({ page, request }) => {
  const user = await registerUser(request, 'notifclearvis');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await resetNotificationsUiState(page);
  await page.goto('/notifications');
  await page.evaluate((channelId) => {
    window.__gratoniteHarness?.clearUnread();
    window.__gratoniteHarness?.markUnread(channelId, 4);
    window.__gratoniteHarness?.markMention(channelId, 2);
  }, scope.channelId);

  await page.locator('.notifications-filter-row').getByRole('button', { name: /^Mentions/i }).click();
  await expect(page.locator('.notifications-filter-row').getByRole('button', { name: /^Mentions/i })).toHaveClass(/active/);
  await expect(page.getByRole('button', { name: 'Clear visible' })).toBeEnabled();
  await page.getByRole('button', { name: 'Clear visible' }).click();
  await expect(page.getByText(/Cleared 1 visible notification/)).toBeVisible();
  await expect(page.locator('.notifications-empty')).toContainText(/mentions/i);

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(
    page
      .locator('.notifications-panel')
      .filter({ hasText: 'Unread Conversations' })
      .locator('.notifications-empty'),
  ).toContainText('caught up');
});

test('opening a notification link marks that conversation as read', async ({ page, request }) => {
  const user = await registerUser(request, 'notifopenread');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await resetNotificationsUiState(page);
  await page.goto('/notifications');
  await page.evaluate((channelId) => {
    window.__gratoniteHarness?.clearUnread();
    window.__gratoniteHarness?.markUnread(channelId, 2);
    window.__gratoniteHarness?.markMention(channelId, 1);
  }, scope.channelId);

  const unreadPanel = page.locator('.notifications-panel').filter({ hasText: 'Unread Conversations' });
  await expect(unreadPanel.locator('.notifications-item').first()).toBeVisible();
  await unreadPanel.locator('.notifications-item-link').first().click();

  await expect(page).not.toHaveURL(/\/notifications$/);
  await page.goto('/notifications');
  await expect(
    page.locator('.notifications-panel').filter({ hasText: 'Unread Conversations' }).locator('.notifications-empty'),
  ).toContainText('caught up');
});

test('notifications empty-state guidance updates by active filter', async ({ page, request }) => {
  const user = await registerUser(request, 'notifemptyguid');
  await authenticateWithToken(page, user.token);
  await resetNotificationsUiState(page);
  await page.goto('/notifications');

  await page.getByRole('button', { name: /^Unread/i }).click();
  await expect(page.locator('.notifications-empty')).toContainText('Switch to All to review requests and mention activity.');

  await page.getByRole('button', { name: /^Friend Requests/i }).click();
  await expect(page.locator('.notifications-empty')).toContainText('Try the All filter to see unread conversation activity too.');
});

test('mobile notifications filter chips remain horizontally scrollable', async ({ page, request }) => {
  const user = await registerUser(request, 'notifchips');
  await authenticateWithToken(page, user.token);
  await page.setViewportSize({ width: 390, height: 844 });
  await resetNotificationsUiState(page);
  await page.goto('/notifications');

  const row = page.locator('.notifications-filter-row');
  await expect(row).toBeVisible();
  const metrics = await row.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflowX: style.overflowX };
  });
  expect(['auto', 'scroll']).toContain(metrics.overflowX);
  expect(metrics.scrollWidth).toBeGreaterThanOrEqual(metrics.clientWidth);
});

test('mobile notifications section headers keep actions and badges visible', async ({ page, request }) => {
  const user = await registerUser(request, 'notifheader');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);
  await page.evaluate((channelId) => {
    window.__gratoniteHarness?.clearUnread();
    window.__gratoniteHarness?.markUnread(channelId, 4);
    window.__gratoniteHarness?.markMention(channelId, 2);
  }, scope.channelId);

  await page.setViewportSize({ width: 390, height: 844 });
  await resetNotificationsUiState(page);
  await page.goto('/notifications');

  const mentionsHead = page.locator('.notifications-panel').filter({ hasText: 'Mentions' }).locator('.notifications-section-head');
  await expect(mentionsHead).toBeVisible();
  await expect(mentionsHead.getByRole('button', { name: 'Collapse', exact: true })).toBeVisible();
  await expect(mentionsHead.locator('.notifications-section-meta')).toContainText('mentions');
  if (await mentionsHead.getByRole('button', { name: 'Clear mentions' }).count()) {
    await expect(mentionsHead.getByRole('button', { name: 'Clear mentions' })).toBeVisible();
  }
});

test('mobile topbar actions remain horizontally scrollable when controls overflow', async ({ page, request }) => {
  const user = await registerUser(request, 'mobtopbar');
  const scope = await createGuildAndTextChannel(request, user.token);

  await page.setViewportSize({ width: 390, height: 844 });
  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  const actions = page.locator('.topbar-actions');
  await expect(actions).toBeVisible();
  const metrics = await actions.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowX: style.overflowX,
    };
  });
  expect(['auto', 'scroll']).toContain(metrics.overflowX);
  expect(metrics.scrollWidth).toBeGreaterThanOrEqual(metrics.clientWidth);
});

test('mobile DM topbar actions remain horizontally scrollable when controls overflow', async ({ page, request }) => {
  const sender = await registerUser(request, 'mobdmtopbar');
  const recipient = await registerUser(request, 'mobdmtoprecv');
  const dmId = await openDmChannel(request, sender.token, recipient.userId);

  await page.setViewportSize({ width: 390, height: 844 });
  await authenticateWithToken(page, sender.token);
  await page.goto(`/dm/${dmId}`);

  const actions = page.locator('.topbar-actions');
  await expect(actions).toBeVisible();
  const metrics = await actions.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowX: style.overflowX,
    };
  });
  expect(['auto', 'scroll']).toContain(metrics.overflowX);
  expect(metrics.scrollWidth).toBeGreaterThanOrEqual(metrics.clientWidth);
});

test('mobile voice more popover uses scroll containment and max height', async ({ page, request }) => {
  const owner = await registerUser(request, 'mobvoicepop');
  const scope = await createGuildWithChannels(request, owner.token, { voiceChannels: ['popover-room'] });
  const voiceChannel = scope.voiceChannels.find((channel) => channel.name === 'popover-room');
  expect(voiceChannel).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${voiceChannel!.id}`);

  await page.evaluate((channelId) => {
    const roomMock = { on: () => undefined, off: () => undefined };
    window.__gratoniteHarness?.setCallState({
      status: 'connected',
      mode: 'guild',
      channelId,
      room: roomMock,
      muted: false,
      videoEnabled: false,
      screenShareEnabled: false,
      localVideoTrack: null,
      localScreenTrack: null,
      error: null,
    });
  }, voiceChannel!.id);

  await page.getByRole('button', { name: 'More ▾' }).click();
  const popover = page.locator('.voice-more-popover');
  await expect(popover).toBeVisible();
  const styles = await popover.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return {
      overflowY: style.overflowY,
      maxHeight: style.maxHeight,
    };
  });
  expect(['auto', 'scroll']).toContain(styles.overflowY);
  expect(styles.maxHeight).not.toBe('none');
});

test('mobile voice soundboard popover keeps upload controls reachable', async ({ page, request }) => {
  const owner = await registerUser(request, 'mobsoundboard');
  const scope = await createGuildWithChannels(request, owner.token, { voiceChannels: ['soundboard-room'] });
  const voiceChannel = scope.voiceChannels.find((channel) => channel.name === 'soundboard-room');
  expect(voiceChannel).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${voiceChannel!.id}`);

  await page.evaluate((channelId) => {
    const roomMock = { on: () => undefined, off: () => undefined };
    window.__gratoniteHarness?.setCallState({
      status: 'connected',
      mode: 'guild',
      channelId,
      room: roomMock,
      muted: false,
      videoEnabled: false,
      screenShareEnabled: false,
      localVideoTrack: null,
      localScreenTrack: null,
      error: null,
    });
  }, voiceChannel!.id);

  await page.getByRole('button', { name: 'Soundboard ▾' }).click();
  const popover = page.locator('.voice-soundboard-popover');
  await expect(popover).toBeVisible();
  await expect(popover.locator('.voice-soundboard-upload-row')).toBeVisible();
  await expect(popover.getByRole('button', { name: /Add Sound|Uploading/i })).toBeVisible();

  const metrics = await popover.locator('.voice-soundboard-upload-row').evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    height: el.clientHeight,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 4);
  expect(metrics.height).toBeGreaterThan(32);
});

test('mobile voice devices popover keeps selects visible and contained', async ({ page, request }) => {
  const owner = await registerUser(request, 'mobdevicespop');
  const scope = await createGuildWithChannels(request, owner.token, { voiceChannels: ['devices-room'] });
  const voiceChannel = scope.voiceChannels.find((channel) => channel.name === 'devices-room');
  expect(voiceChannel).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${voiceChannel!.id}`);

  await page.evaluate((channelId) => {
    const roomMock = { on: () => undefined, off: () => undefined };
    window.__gratoniteHarness?.setCallState({
      status: 'connected',
      mode: 'guild',
      channelId,
      room: roomMock,
      muted: false,
      videoEnabled: false,
      screenShareEnabled: false,
      localVideoTrack: null,
      localScreenTrack: null,
      error: null,
    });
  }, voiceChannel!.id);

  await page.getByRole('button', { name: 'Devices ▾' }).click();
  const popover = page.locator('.voice-devices-popover');
  await expect(popover).toBeVisible();
  const selects = popover.locator('select');
  await expect(selects).toHaveCount(3);

  const popoverMetrics = await popover.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  expect(popoverMetrics.sw).toBeLessThanOrEqual(popoverMetrics.cw + 4);
  for (let i = 0; i < 3; i += 1) {
    const metrics = await selects.nth(i).evaluate((el) => ({ h: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth }));
    expect(metrics.h).toBeGreaterThanOrEqual(32);
    expect(metrics.sw).toBeLessThanOrEqual(metrics.cw + 4);
  }
});

test('mobile short-height voice layout keeps grid above controls', async ({ page, request }) => {
  const owner = await registerUser(request, 'mobvoiceheight');
  const scope = await createGuildWithChannels(request, owner.token, { voiceChannels: ['short-room'] });
  const voiceChannel = scope.voiceChannels.find((channel) => channel.name === 'short-room');
  expect(voiceChannel).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 700 });
  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${voiceChannel!.id}`);

  await page.evaluate((channelId) => {
    const roomMock = { on: () => undefined, off: () => undefined };
    window.__gratoniteHarness?.setCallState({
      status: 'connected',
      mode: 'guild',
      channelId,
      room: roomMock,
      muted: false,
      videoEnabled: false,
      screenShareEnabled: false,
      localVideoTrack: null,
      localScreenTrack: null,
      error: null,
    });
  }, voiceChannel!.id);

  const grid = page.locator('.voice-grid');
  const dock = page.locator('.voice-control-dock');
  await expect(grid).toBeVisible();
  await expect(dock).toBeVisible();

  const gridBox = await grid.boundingBox();
  const dockBox = await dock.boundingBox();
  expect(gridBox).toBeTruthy();
  expect(dockBox).toBeTruthy();
  expect((gridBox?.y ?? 0) + (gridBox?.height ?? 0)).toBeLessThanOrEqual((dockBox?.y ?? 99999) + 2);
});

test('mobile composer mention menu closes cleanly when attachments are added', async ({ page, request }) => {
  const user = await registerUser(request, 'mobmentionattach');
  const other = await registerUser(request, 'mobmentionpeer');
  const scope = await createGuildAndTextChannel(request, user.token);

  const inviteRes = await request.post(`${API_BASE}/invites/guilds/${scope.guildId}/invites`, {
    headers: { Authorization: `Bearer ${user.token}` },
    data: { channelId: scope.channelId },
  });
  expect(inviteRes.ok()).toBeTruthy();
  const invite = (await inviteRes.json()) as { code: string };
  const joinRes = await request.post(`${API_BASE}/invites/${invite.code}`, {
    headers: { Authorization: `Bearer ${other.token}` },
  });
  expect(joinRes.ok()).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  const composer = page.locator('.message-composer-input');
  await composer.fill('@');
  await page.waitForTimeout(150);
  await expect(page.locator('.composer-mention-menu')).toBeVisible();

  const uploader = page.locator('input[type=\"file\"]');
  await uploader.setInputFiles({
    name: `mention-close-${Date.now()}.txt`,
    mimeType: 'text/plain',
    buffer: Buffer.from('attachment'),
  });

  await expect.poll(async () => await page.locator('.composer-mention-menu').count()).toBe(0);
  await composer.fill(`after mention ${Date.now()}`);
  await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
});

test('sends a message in DM and persists after refresh', async ({ page, request }) => {
  const sender = await registerUser(request, 'dmsender');
  const recipient = await registerUser(request, 'dmrecv');
  const dmId = await openDmChannel(request, sender.token, recipient.userId);

  await authenticateWithToken(page, sender.token);
  await page.goto(`/dm/${dmId}`);

  const composer = page.locator('.message-composer-input');
  await expect(composer).toBeVisible();

  const text = `dm-e2e message ${Date.now()}`;
  await composer.fill(text);
  await composer.press('Enter');

  const sentMessage = page.locator('.message-content', { hasText: text }).last();
  await expect(sentMessage).toBeVisible();

  await page.reload();
  await expect(page.locator('.message-content', { hasText: text }).last()).toBeVisible();
});

test('delivers DM messages in realtime across two active clients', async ({ browser, request }) => {
  const sender = await registerUser(request, 'dmrtsender');
  const recipient = await registerUser(request, 'dmrtrecv');
  const dmId = await openDmChannel(request, sender.token, recipient.userId);

  const senderContext = await browser.newContext();
  const recipientContext = await browser.newContext();
  const senderPage = await senderContext.newPage();
  const recipientPage = await recipientContext.newPage();

  await authenticateWithToken(senderPage, sender.token);
  await authenticateWithToken(recipientPage, recipient.token);

  await Promise.all([
    senderPage.goto(`/dm/${dmId}`),
    recipientPage.goto(`/dm/${dmId}`),
  ]);

  const text = `dm-realtime ${Date.now()}`;
  await senderPage.locator('.message-composer-input').fill(text);
  await senderPage.getByRole('button', { name: 'Send message' }).click();

  await expect(recipientPage.locator('.message-content', { hasText: text }).last()).toBeVisible();

  await senderContext.close();
  await recipientContext.close();
});

test('delivers DM attachment messages in realtime across two active clients', async ({ browser, request }) => {
  const sender = await registerUser(request, 'dmattsender');
  const recipient = await registerUser(request, 'dmattrecv');
  const dmId = await openDmChannel(request, sender.token, recipient.userId);

  const senderContext = await browser.newContext();
  const recipientContext = await browser.newContext();
  const senderPage = await senderContext.newPage();
  const recipientPage = await recipientContext.newPage();

  await authenticateWithToken(senderPage, sender.token);
  await authenticateWithToken(recipientPage, recipient.token);

  await Promise.all([
    senderPage.goto(`/dm/${dmId}`),
    recipientPage.goto(`/dm/${dmId}`),
  ]);

  const uploader = senderPage.locator('input[type="file"]');
  await expect(uploader).toBeAttached();

  const filename = `dm-realtime-attachment-${Date.now()}.txt`;
  await uploader.setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from('dm realtime attachment test'),
  });
  await senderPage.getByRole('button', { name: 'Send message' }).click();

  await expect(recipientPage.locator('.attachment-file-name', { hasText: filename }).last()).toBeVisible();

  await senderContext.close();
  await recipientContext.close();
});

test('delivers guild attachment messages in realtime across two active clients', async ({ browser, request }) => {
  const owner = await registerUser(request, 'guildattsender');
  const member = await registerUser(request, 'guildattmember');
  const scope = await createGuildWithChannels(request, owner.token, {
    textChannels: ['attachment-room'],
  });
  const targetChannel = scope.textChannels.find((channel) => channel.name === 'attachment-room');
  expect(scope.generalChannelId).toBeTruthy();
  expect(targetChannel).toBeTruthy();

  const inviteRes = await request.post(`${API_BASE}/invites/guilds/${scope.guildId}/invites`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { channelId: scope.generalChannelId },
  });
  expect(inviteRes.ok()).toBeTruthy();
  const invite = (await inviteRes.json()) as { code: string };

  const acceptRes = await request.post(`${API_BASE}/invites/${invite.code}`, {
    headers: { Authorization: `Bearer ${member.token}` },
  });
  expect(acceptRes.ok()).toBeTruthy();

  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const memberPage = await memberContext.newPage();

  await authenticateWithToken(ownerPage, owner.token);
  await authenticateWithToken(memberPage, member.token);

  await Promise.all([
    ownerPage.goto(`/guild/${scope.guildId}/channel/${targetChannel!.id}`),
    memberPage.goto(`/guild/${scope.guildId}/channel/${targetChannel!.id}`),
  ]);

  const uploader = ownerPage.locator('input[type="file"]');
  await expect(uploader).toBeAttached();

  const filename = `guild-realtime-attachment-${Date.now()}.txt`;
  await uploader.setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from('guild realtime attachment test'),
  });
  await ownerPage.getByRole('button', { name: 'Send message' }).click();

  await expect(memberPage.locator('.attachment-file-name', { hasText: filename }).last()).toBeVisible();

  await ownerContext.close();
  await memberContext.close();
});

test('shows DM typing indicator using display name across active clients', async ({ browser, request }) => {
  const sender = await registerUser(request, 'dmtypesender');
  const recipient = await registerUser(request, 'dmtyperecv');
  const dmId = await openDmChannel(request, sender.token, recipient.userId);

  const senderContext = await browser.newContext();
  const recipientContext = await browser.newContext();
  const senderPage = await senderContext.newPage();
  const recipientPage = await recipientContext.newPage();

  await authenticateWithToken(senderPage, sender.token);
  await authenticateWithToken(recipientPage, recipient.token);

  await Promise.all([
    senderPage.goto(`/dm/${dmId}`),
    recipientPage.goto(`/dm/${dmId}`),
  ]);

  const senderComposer = senderPage.locator('.message-composer-input');
  await expect(senderComposer).toBeVisible();
  await senderComposer.fill(`typing-${Date.now()}`);

  const typingText = recipientPage.locator('.typing-text');
  await expect(typingText).toContainText('is typing');
  await expect(typingText).not.toContainText(sender.userId);

  await senderContext.close();
  await recipientContext.close();
});

test('submits DM message when composer receives iOS-style newline input', async ({ page, request }) => {
  const sender = await registerUser(request, 'dmiossend');
  const recipient = await registerUser(request, 'dmiosrecv');
  const dmId = await openDmChannel(request, sender.token, recipient.userId);

  await authenticateWithToken(page, sender.token);
  await page.goto(`/dm/${dmId}`);

  const composer = page.locator('.message-composer-input');
  await expect(composer).toBeVisible();

  const text = `dm-ios-newline ${Date.now()}`;
  await composer.fill(`${text}\n`);

  await expect(page.locator('.message-content', { hasText: text }).last()).toBeVisible();
});

test('submits guild message when composer receives iOS-style newline input', async ({ page, request }) => {
  const user = await registerUser(request, 'guildiossend');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  const composer = page.locator('.message-composer-input');
  await expect(composer).toBeVisible();

  const text = `guild-ios-newline ${Date.now()}`;
  await composer.fill(`${text}\n`);

  await expect(page.locator('.message-content', { hasText: text }).last()).toBeVisible();
});

test('allows attachments-only send via send button', async ({ page, request }) => {
  const user = await registerUser(request, 'attachonly');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  const sendButton = page.getByRole('button', { name: 'Send message' });
  await expect(sendButton).toBeDisabled();

  const uploader = page.locator('input[type="file"]');
  await expect(uploader).toBeAttached();

  const filename = `attachment-only-${Date.now()}.txt`;
  await uploader.setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from('attachment only send'),
  });

  await expect(sendButton).toBeEnabled();
  await sendButton.click();
  await expect(page.locator('.attachment-file-name', { hasText: filename }).last()).toBeVisible();
});

test('shows send failure state when message create request fails', async ({ page, request }) => {
  const user = await registerUser(request, 'msgfail');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  await page.route('**/api/v1/channels/*/messages', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'forced failure' }),
    });
  });

  const composer = page.locator('.message-composer-input');
  const text = `forced-send-fail ${Date.now()}`;
  await composer.fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.locator('.home-error')).toBeVisible();
  await page.unroute('**/api/v1/channels/*/messages');
});

test('allows retry after attachment upload failure', async ({ page, request }) => {
  const user = await registerUser(request, 'attretry');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  let failUploadOnce = true;
  await page.route('**/api/v1/files/upload', async (route) => {
    if (failUploadOnce) {
      failUploadOnce = false;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'forced upload failure' }),
      });
      return;
    }
    await route.continue();
  });

  const uploader = page.locator('input[type="file"]');
  const text = `attachment-retry ${Date.now()}`;
  const filename = `attachment-retry-${Date.now()}.txt`;

  await uploader.setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from('retry failure then success'),
  });
  await page.locator('.message-composer-input').fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.home-error')).toBeVisible();

  await uploader.setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from('retry success'),
  });
  await page.locator('.message-composer-input').fill(`${text}-retry`);
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.locator('.attachment-file-name', { hasText: filename }).last()).toBeVisible();
  await page.unroute('**/api/v1/files/upload');
});

test('marks unread on off-channel message and clears after opening target channel', async ({ page, request }) => {
  const owner = await registerUser(request, 'unreadowner');
  const member = await registerUser(request, 'unreadmember');
  const scope = await createGuildWithChannels(request, owner.token, {
    textChannels: ['alpha-room', 'beta-room'],
  });
  const alpha = scope.textChannels.find((channel) => channel.name === 'alpha-room');
  const beta = scope.textChannels.find((channel) => channel.name === 'beta-room');
  expect(scope.generalChannelId).toBeTruthy();
  expect(alpha).toBeTruthy();
  expect(beta).toBeTruthy();

  const inviteRes = await request.post(`${API_BASE}/invites/guilds/${scope.guildId}/invites`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { channelId: scope.generalChannelId },
  });
  expect(inviteRes.ok()).toBeTruthy();
  const invite = (await inviteRes.json()) as { code: string };

  const acceptRes = await request.post(`${API_BASE}/invites/${invite.code}`, {
    headers: { Authorization: `Bearer ${member.token}` },
  });
  expect(acceptRes.ok()).toBeTruthy();

  await authenticateWithToken(page, member.token);
  await page.goto(`/guild/${scope.guildId}/channel/${alpha!.id}`);

  const sendRes = await request.post(`${API_BASE}/channels/${beta!.id}/messages`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: {
      content: `off-channel-unread ${Date.now()}`,
      nonce: `nonce-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    },
  });
  expect(sendRes.ok()).toBeTruthy();

  const betaItem = page.locator('.channel-item', { hasText: 'beta-room' }).first();
  await expect
    .poll(async () => {
      const state = await page.evaluate(() => window.__gratoniteHarness?.getUnreadState?.());
      return Array.isArray(state?.unreadByChannel) ? state!.unreadByChannel.includes(beta!.id) : false;
    })
    .toBe(true);
  await expect(betaItem.locator('.channel-unread-badge, .channel-unread-dot')).toHaveCount(1);

  await betaItem.click();
  await expect(page).toHaveURL(new RegExp(beta!.id));
  await expect(betaItem.locator('.channel-unread-badge, .channel-unread-dot')).toHaveCount(0);
});

test('retains all messages under rapid concurrent sends from two members', async ({ browser, request }) => {
  const owner = await registerUser(request, 'concurrentowner');
  const member = await registerUser(request, 'concurrentmember');
  const scope = await createGuildAndTextChannel(request, owner.token);

  const inviteRes = await request.post(`${API_BASE}/invites/guilds/${scope.guildId}/invites`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { channelId: scope.channelId },
  });
  expect(inviteRes.ok()).toBeTruthy();
  const invite = (await inviteRes.json()) as { code: string };

  const acceptRes = await request.post(`${API_BASE}/invites/${invite.code}`, {
    headers: { Authorization: `Bearer ${member.token}` },
  });
  expect(acceptRes.ok()).toBeTruthy();

  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const memberPage = await memberContext.newPage();

  await authenticateWithToken(ownerPage, owner.token);
  await authenticateWithToken(memberPage, member.token);

  await Promise.all([
    ownerPage.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`),
    memberPage.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`),
  ]);

  const ownerText = `owner-concurrent-${Date.now()}`;
  const memberText = `member-concurrent-${Date.now()}`;

  await Promise.all([
    (async () => {
      await ownerPage.locator('.message-composer-input').fill(ownerText);
      await ownerPage.getByRole('button', { name: 'Send message' }).click();
    })(),
    (async () => {
      await memberPage.locator('.message-composer-input').fill(memberText);
      await memberPage.getByRole('button', { name: 'Send message' }).click();
    })(),
  ]);

  await expect(ownerPage.locator('.message-content', { hasText: ownerText }).last()).toBeVisible();
  await expect(ownerPage.locator('.message-content', { hasText: memberText }).last()).toBeVisible();
  await expect(memberPage.locator('.message-content', { hasText: ownerText }).last()).toBeVisible();
  await expect(memberPage.locator('.message-content', { hasText: memberText }).last()).toBeVisible();

  await ownerContext.close();
  await memberContext.close();
});

test('retains all messages under rapid concurrent sends from five members (api smoke)', async ({ request }) => {
  const owner = await registerUser(request, 'concurrent5o');
  const members = await Promise.all([
    registerUser(request, 'concurrent5a'),
    registerUser(request, 'concurrent5b'),
    registerUser(request, 'concurrent5c'),
    registerUser(request, 'concurrent5d'),
  ]);
  const scope = await createGuildAndTextChannel(request, owner.token);

  for (const member of members) {
    const inviteRes = await postWithRateLimitRetry(request, `${API_BASE}/invites/guilds/${scope.guildId}/invites`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { channelId: scope.channelId },
    });
    expect(inviteRes.ok()).toBeTruthy();
    const invite = (await inviteRes.json()) as { code: string };
    const acceptRes = await postWithRateLimitRetry(request, `${API_BASE}/invites/${invite.code}`, {
      headers: { Authorization: `Bearer ${member.token}` },
      data: {},
    });
    expect(acceptRes.ok()).toBeTruthy();
  }

  const allUsers = [owner, ...members];
  const messages = allUsers.map((user, index) => ({
    user,
    content: `concurrent5-${index}-${Date.now()}`,
    nonce: `nonce-${Date.now()}-${index}-${Math.floor(Math.random() * 10000)}`,
  }));

  const sendResults = await Promise.all(
    messages.map((entry) =>
      postWithRateLimitRetry(request, `${API_BASE}/channels/${scope.channelId}/messages`, {
        headers: { Authorization: `Bearer ${entry.user.token}` },
        data: { content: entry.content, nonce: entry.nonce },
      }, 5),
    ),
  );

  for (const res of sendResults) {
    expect(res.ok()).toBeTruthy();
  }

  const listRes = await request.get(`${API_BASE}/channels/${scope.channelId}/messages?limit=50`, {
    headers: { Authorization: `Bearer ${owner.token}` },
  });
  expect(listRes.ok()).toBeTruthy();
  const list = (await listRes.json()) as Array<{ content: string }>;
  for (const entry of messages) {
    expect(list.some((m) => m.content === entry.content)).toBeTruthy();
  }
});

test('reorders DM list in realtime when another DM receives a new message', async ({ page, request }) => {
  const owner = await registerUser(request, 'dmorderowner');
  const alpha = await registerUser(request, 'dmorderalpha');
  const bravo = await registerUser(request, 'dmorderbravo');

  const alphaDmId = await openDmChannel(request, owner.token, alpha.userId);
  const bravoDmId = await openDmChannel(request, owner.token, bravo.userId);

  await authenticateWithToken(page, owner.token);
  await page.goto('/');

  const dmItems = page.locator('.channel-sidebar-list .channel-item');
  await expect(dmItems.first()).toBeVisible();

  const sendToBravoRes = await postWithRateLimitRetry(request, `${API_BASE}/channels/${bravoDmId}/messages`, {
    headers: { Authorization: `Bearer ${bravo.token}` },
    data: {
      content: `dm-order-bravo ${Date.now()}`,
      nonce: `nonce-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    },
  });
  expect(sendToBravoRes.ok()).toBeTruthy();
  await expect(dmItems.first().locator('.channel-name')).toContainText(bravo.username);

  const sendToAlphaRes = await postWithRateLimitRetry(request, `${API_BASE}/channels/${alphaDmId}/messages`, {
    headers: { Authorization: `Bearer ${alpha.token}` },
    data: {
      content: `dm-order-alpha ${Date.now()}`,
      nonce: `nonce-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    },
  });
  expect(sendToAlphaRes.ok()).toBeTruthy();
  await expect(dmItems.first().locator('.channel-name')).toContainText(alpha.username);
});

test('switches own message avatar between sprite and fallback avatar when avatar studio setting changes', async ({ page, request }) => {
  const user = await registerUser(request, 'avatarsprite');
  const scope = await createGuildAndTextChannel(request, user.token);

  await page.addInitScript((payload: { token: string; userId: string }) => {
    localStorage.setItem('gratonite_access_token', payload.token);
    localStorage.setItem(
      `gratonite_avatar_studio_v1:${payload.userId}`,
      JSON.stringify({
        enabled: true,
        sprite: {
          skinTone: '#f6d3b9',
          hairColor: '#1f1f1f',
          hairStyle: 'short',
          faceStyle: 'smile',
          topColor: '#4c6fff',
          bottomColor: '#263659',
          shoesColor: '#10161f',
          hatStyle: 'none',
          accessoryStyle: 'none',
        },
        equipped: {
          hat: null,
          top: null,
          bottom: null,
          shoes: null,
          accessory: null,
        },
      }),
    );
  }, { token: user.token, userId: user.userId });

  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  const composer = page.locator('.message-composer-input');
  const text = `avatar-mode-toggle ${Date.now()}`;
  await composer.fill(text);
  await composer.press('Enter');

  await expect(page.locator('.message-content', { hasText: text }).last()).toBeVisible();
  await expect(page.locator('.message-avatar-sprite').first()).toBeVisible();

  await page.evaluate((userId) => {
    window.localStorage.setItem(
      `gratonite_avatar_studio_v1:${userId}`,
      JSON.stringify({
        enabled: false,
        sprite: {
          skinTone: '#f6d3b9',
          hairColor: '#1f1f1f',
          hairStyle: 'short',
          faceStyle: 'smile',
          topColor: '#4c6fff',
          bottomColor: '#263659',
          shoesColor: '#10161f',
          hatStyle: 'none',
          accessoryStyle: 'none',
        },
        equipped: {
          hat: null,
          top: null,
          bottom: null,
          shoes: null,
          accessory: null,
        },
      }),
    );
    window.dispatchEvent(new CustomEvent('gratonite:avatar-studio:changed', { detail: { userId } }));
  }, user.userId);

  await expect(page.locator('.message-avatar-sprite')).toHaveCount(0);
  await expect(page.locator('.message-avatar').first()).toBeVisible();
});

test('clears pending attachments from composer before sending', async ({ page, request }) => {
  const user = await registerUser(request, 'attachclear');
  const scope = await createGuildAndTextChannel(request, user.token);

  await authenticateWithToken(page, user.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.channelId}`);

  const uploader = page.locator('input[type="file"]');
  const sendButton = page.getByRole('button', { name: 'Send message' });
  await expect(sendButton).toBeDisabled();

  await uploader.setInputFiles([
    {
      name: `clear-a-${Date.now()}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from('clear attachments a'),
    },
    {
      name: `clear-b-${Date.now()}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from('clear attachments b'),
    },
  ]);

  await expect(page.locator('.attachment-preview-item-compact')).toHaveCount(2);
  await expect(sendButton).toBeEnabled();
  await page.getByRole('button', { name: 'Clear all attachments' }).click();
  await expect(page.locator('.attachment-preview-item-compact')).toHaveCount(0);
  await expect(sendButton).toBeDisabled();
});
