import { expect, test } from '@playwright/test';
import { authenticateWithToken, createGuildWithChannels, registerUser } from './helpers';

const VIEW_CHANNEL_BIT = (1n << 10n).toString();

test('private channel visibility is enforced for invited members', async ({ request }) => {
  const owner = await registerUser(request, 'owner');
  const guest = await registerUser(request, 'guest');
  const scope = await createGuildWithChannels(request, owner.token, {
    textChannels: ['private-room', 'public-room'],
  });

  const privateChannel = scope.textChannels.find((channel) => channel.name === 'private-room');
  const publicChannel = scope.textChannels.find((channel) => channel.name === 'public-room');
  expect(privateChannel).toBeTruthy();
  expect(publicChannel).toBeTruthy();
  expect(scope.generalChannelId).toBeTruthy();

  const rolesRes = await request.get(`http://127.0.0.1:4000/api/v1/guilds/${scope.guildId}/roles`, {
    headers: { Authorization: `Bearer ${owner.token}` },
  });
  expect(rolesRes.ok()).toBeTruthy();
  const roles = (await rolesRes.json()) as Array<{ id: string; name: string }>;
  const everyoneRole = roles.find((role) => role.name === '@everyone');
  expect(everyoneRole).toBeTruthy();

  const lockRes = await request.put(
    `http://127.0.0.1:4000/api/v1/channels/${privateChannel!.id}/permissions/${everyoneRole!.id}`,
    {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: {
        type: 'role',
        allow: '0',
        deny: VIEW_CHANNEL_BIT,
      },
    },
  );
  expect(lockRes.ok()).toBeTruthy();

  const inviteRes = await request.post(`http://127.0.0.1:4000/api/v1/invites/guilds/${scope.guildId}/invites`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { channelId: scope.generalChannelId },
  });
  expect(inviteRes.ok()).toBeTruthy();
  const invite = (await inviteRes.json()) as { code: string };

  const acceptRes = await request.post(`http://127.0.0.1:4000/api/v1/invites/${invite.code}`, {
    headers: { Authorization: `Bearer ${guest.token}` },
  });
  expect(acceptRes.ok()).toBeTruthy();

  const channelsRes = await request.get(`http://127.0.0.1:4000/api/v1/guilds/${scope.guildId}/channels`, {
    headers: { Authorization: `Bearer ${guest.token}` },
  });
  expect(channelsRes.ok()).toBeTruthy();
  const visibleChannels = (await channelsRes.json()) as Array<{ id: string; name: string | null }>;
  const visibleIds = new Set(visibleChannels.map((channel) => channel.id));

  expect(visibleIds.has(publicChannel!.id)).toBeTruthy();
  expect(visibleIds.has(privateChannel!.id)).toBeFalsy();
});

test('deleting a channel via sidebar context menu confirms and routes to a safe fallback', async ({ page, request }) => {
  const owner = await registerUser(request, 'chdel');
  const scope = await createGuildWithChannels(request, owner.token, {
    textChannels: ['alpha-room', 'beta-room'],
  });
  const alphaChannel = scope.textChannels.find((channel) => channel.name === 'alpha-room');
  expect(alphaChannel).toBeTruthy();

  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${alphaChannel!.id}`);

  const alphaItem = page.locator('.channel-item', { hasText: 'alpha-room' }).first();
  await expect(alphaItem).toBeVisible();
  await alphaItem.click({ button: 'right' });

  await page.getByRole('menuitem', { name: 'Delete Channel' }).click();

  const modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();
  await modal.getByLabel('Type the channel name to confirm').fill('alpha-room');
  await modal.getByRole('button', { name: 'Delete Channel' }).click();

  await expect(page).toHaveURL(new RegExp(`/guild/${scope.guildId}/channel/`));
  await expect(page).not.toHaveURL(new RegExp(alphaChannel!.id));
  await expect(page.locator('.channel-item', { hasText: 'alpha-room' })).toHaveCount(0);
});

test('voice channels present silent-room entry UX cues', async ({ page, request }) => {
  const owner = await registerUser(request, 'voiceui');
  const scope = await createGuildWithChannels(request, owner.token, {
    voiceChannels: ['focus-room'],
  });
  const voiceChannel = scope.voiceChannels.find((channel) => channel.name === 'focus-room');
  expect(voiceChannel).toBeTruthy();

  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${voiceChannel!.id}`);

  const joinButton = page.getByRole('button', { name: 'Join Room Silently' });
  const leaveButton = page.getByRole('button', { name: 'Leave Call' });
  await expect(joinButton.or(leaveButton)).toBeVisible();
  await expect(page.locator('.voice-channel-subtle-status')).toContainText(/Connected silently|Joining room|Not connected/);
  await expect(page.locator('.dm-call-incoming')).toHaveCount(0);
});

test('server gallery media controls persist fit and animation preferences', async ({ page, request }) => {
  const owner = await registerUser(request, 'gallery');
  await createGuildWithChannels(request, owner.token, {
    textChannels: ['lobby'],
  });

  await page.addInitScript(() => {
    localStorage.setItem('ui_v2_tokens', '1');
    localStorage.setItem('gratonite_server_gallery_media_fit_v1', 'contain');
    localStorage.setItem('gratonite_server_gallery_animated_v1', 'off');
  });
  await authenticateWithToken(page, owner.token);
  await page.goto('/');

  const gallery = page.locator('.server-gallery');
  await expect(gallery).toBeVisible();
  await expect(gallery).toHaveAttribute('data-media-fit', 'contain');
  await expect(gallery).toHaveAttribute('data-animated-banners', 'off');

  await page.getByRole('button', { name: 'Fill cards' }).click();
  await expect(gallery).toHaveAttribute('data-media-fit', 'cover');

  await page.getByRole('button', { name: 'Animated banners off' }).click();
  await expect(gallery).toHaveAttribute('data-animated-banners', 'on');
});

test('portal gallery search and favorites persist across refresh', async ({ page, request }) => {
  const owner = await registerUser(request, 'galleryfav');
  const alphaRes = await request.post('http://127.0.0.1:4000/api/v1/guilds', {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { name: 'Alpha Portal QA' },
  });
  expect(alphaRes.ok()).toBeTruthy();
  const alpha = (await alphaRes.json()) as { id: string };

  const betaRes = await request.post('http://127.0.0.1:4000/api/v1/guilds', {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { name: 'Beta Portal QA' },
  });
  expect(betaRes.ok()).toBeTruthy();
  const beta = (await betaRes.json()) as { id: string };

  await page.addInitScript(() => {
    localStorage.setItem('ui_v2_tokens', '1');
  });
  await authenticateWithToken(page, owner.token);
  await page.goto('/');

  const allGrid = page.locator('.server-gallery-grid').first();
  await expect(allGrid.locator('.server-gallery-card[href]')).toHaveCount(2);

  await page.locator(`.server-gallery-card[href=\"/guild/${alpha.id}\"] .server-gallery-favorite`).first().click();
  await expect(page.locator(`.server-gallery-card[href=\"/guild/${alpha.id}\"] .server-gallery-favorite`).first()).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel('Find a portal').fill('Beta Portal QA');
  await expect(allGrid.locator(`.server-gallery-card[href=\"/guild/${beta.id}\"]`)).toBeVisible();
  await expect(allGrid.locator(`.server-gallery-card[href=\"/guild/${alpha.id}\"]`)).toHaveCount(0);

  await page.reload();
  await expect(page.locator(`.server-gallery-card[href=\"/guild/${alpha.id}\"] .server-gallery-favorite`).first()).toHaveAttribute('aria-pressed', 'true');
});

test('voice control harness exposes camera and screenshare state contracts', async ({ page, request }) => {
  const owner = await registerUser(request, 'voiceharness');
  const scope = await createGuildWithChannels(request, owner.token, {
    voiceChannels: ['contract-room'],
  });
  const voiceChannel = scope.voiceChannels.find((channel) => channel.name === 'contract-room');
  expect(voiceChannel).toBeTruthy();

  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${voiceChannel!.id}`);
  await expect(page.locator('.voice-channel-view')).toBeVisible();

  const harnessAvailable = await page.evaluate(() => Boolean(window.__gratoniteHarness));
  expect(harnessAvailable).toBeTruthy();

  await page.evaluate((channelId) => {
    const roomMock = {
      on: () => undefined,
      off: () => undefined,
    };
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
  await expect(page.locator('.voice-control-dock')).toBeVisible();

  const cameraButton = page.getByRole('button', { name: 'Camera' });
  await expect(cameraButton).toHaveAttribute('aria-pressed', 'false');

  await page.evaluate(() => {
    window.__gratoniteHarness?.setCallState({
      videoEnabled: true,
    });
  });
  await expect(page.getByRole('button', { name: 'Stop Video' })).toHaveAttribute('aria-pressed', 'true');

  await page.evaluate(() => {
    window.__gratoniteHarness?.setCallState({
      screenShareEnabled: true,
      localScreenTrack: null,
    });
  });
  await expect(page.locator('.voice-video-tile-pending')).toBeVisible();
  await expect(page.locator('.voice-video-tile-pending .voice-video-label')).toContainText('Screen share is starting');
});

test('voice channel shell remains usable on mobile viewport', async ({ page, request }) => {
  const owner = await registerUser(request, 'voicemobile');
  const scope = await createGuildWithChannels(request, owner.token, {
    voiceChannels: ['mobile-room'],
  });
  const voiceChannel = scope.voiceChannels.find((channel) => channel.name === 'mobile-room');
  expect(voiceChannel).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${voiceChannel!.id}`);
  await expect(page.locator('.voice-channel-view')).toBeVisible();

  await page.evaluate((channelId) => {
    const roomMock = {
      on: () => undefined,
      off: () => undefined,
    };
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

  await expect(page.locator('.voice-control-dock')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Camera' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Share( Screen)?|Stop Sharing|Share Off/i })).toBeVisible();
});

test('role assignment workflow APIs assign and remove member roles safely', async ({ request }) => {
  const owner = await registerUser(request, 'roleflow');
  const member = await registerUser(request, 'roleflowm');
  const scope = await createGuildWithChannels(request, owner.token, {
    textChannels: ['lobby'],
  });

  const inviteRes = await request.post(`http://127.0.0.1:4000/api/v1/invites/guilds/${scope.guildId}/invites`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { channelId: scope.generalChannelId },
  });
  expect(inviteRes.ok()).toBeTruthy();
  const invite = (await inviteRes.json()) as { code: string };
  const acceptRes = await request.post(`http://127.0.0.1:4000/api/v1/invites/${invite.code}`, {
    headers: { Authorization: `Bearer ${member.token}` },
  });
  expect(acceptRes.ok()).toBeTruthy();

  const createRoleRes = await request.post(`http://127.0.0.1:4000/api/v1/guilds/${scope.guildId}/roles`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { name: `qa-role-${Date.now()}`, mentionable: true },
  });
  expect(createRoleRes.ok()).toBeTruthy();
  const role = (await createRoleRes.json()) as { id: string; name: string };

  const assignRes = await request.put(
    `http://127.0.0.1:4000/api/v1/guilds/${scope.guildId}/members/${member.userId}/roles/${role.id}`,
    { headers: { Authorization: `Bearer ${owner.token}` } },
  );
  expect(assignRes.ok()).toBeTruthy();

  const memberRolesRes = await request.get(
    `http://127.0.0.1:4000/api/v1/guilds/${scope.guildId}/members/${member.userId}/roles`,
    { headers: { Authorization: `Bearer ${owner.token}` } },
  );
  expect(memberRolesRes.ok()).toBeTruthy();
  const memberRoles = (await memberRolesRes.json()) as Array<{ id: string; name: string }>;
  expect(memberRoles.some((r) => r.id === role.id)).toBeTruthy();

  const removeRes = await request.delete(
    `http://127.0.0.1:4000/api/v1/guilds/${scope.guildId}/members/${member.userId}/roles/${role.id}`,
    { headers: { Authorization: `Bearer ${owner.token}` } },
  );
  expect(removeRes.ok()).toBeTruthy();

  const memberRolesResAfter = await request.get(
    `http://127.0.0.1:4000/api/v1/guilds/${scope.guildId}/members/${member.userId}/roles`,
    { headers: { Authorization: `Bearer ${owner.token}` } },
  );
  expect(memberRolesResAfter.ok()).toBeTruthy();
  const memberRolesAfter = (await memberRolesResAfter.json()) as Array<{ id: string; name: string }>;
  expect(memberRolesAfter.some((r) => r.id === role.id)).toBeFalsy();
});

test('channel permission override workflow APIs grant and remove visibility overrides', async ({ request }) => {
  const owner = await registerUser(request, 'permflow');
  const member = await registerUser(request, 'permflowm');
  const scope = await createGuildWithChannels(request, owner.token, {
    textChannels: ['access-room'],
  });
  const targetChannel = scope.textChannels.find((channel) => channel.name === 'access-room');
  expect(targetChannel).toBeTruthy();

  const rolesRes = await request.get(`http://127.0.0.1:4000/api/v1/guilds/${scope.guildId}/roles`, {
    headers: { Authorization: `Bearer ${owner.token}` },
  });
  expect(rolesRes.ok()).toBeTruthy();
  const roles = (await rolesRes.json()) as Array<{ id: string; name: string }>;
  const everyoneRole = roles.find((role) => role.name === '@everyone');
  expect(everyoneRole).toBeTruthy();

  const inviteRes = await request.post(`http://127.0.0.1:4000/api/v1/invites/guilds/${scope.guildId}/invites`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { channelId: scope.generalChannelId },
  });
  expect(inviteRes.ok()).toBeTruthy();
  const invite = (await inviteRes.json()) as { code: string };
  const acceptRes = await request.post(`http://127.0.0.1:4000/api/v1/invites/${invite.code}`, {
    headers: { Authorization: `Bearer ${member.token}` },
  });
  expect(acceptRes.ok()).toBeTruthy();

  const lockRes = await request.put(
    `http://127.0.0.1:4000/api/v1/channels/${targetChannel!.id}/permissions/${everyoneRole!.id}`,
    {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { type: 'role', allow: '0', deny: VIEW_CHANNEL_BIT },
    },
  );
  expect(lockRes.ok()).toBeTruthy();

  const grantMemberRes = await request.put(
    `http://127.0.0.1:4000/api/v1/channels/${targetChannel!.id}/permissions/${member.userId}`,
    {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { type: 'user', allow: VIEW_CHANNEL_BIT, deny: '0' },
    },
  );
  expect(grantMemberRes.ok()).toBeTruthy();

  const overridesRes = await request.get(`http://127.0.0.1:4000/api/v1/channels/${targetChannel!.id}/permissions`, {
    headers: { Authorization: `Bearer ${owner.token}` },
  });
  expect(overridesRes.ok()).toBeTruthy();
  const overrides = (await overridesRes.json()) as Array<{ targetId: string; targetType: string }>;
  expect(overrides.some((o) => o.targetId === everyoneRole!.id && o.targetType === 'role')).toBeTruthy();
  expect(overrides.some((o) => o.targetId === member.userId && o.targetType === 'user')).toBeTruthy();

  const removeMemberOverrideRes = await request.delete(
    `http://127.0.0.1:4000/api/v1/channels/${targetChannel!.id}/permissions/${member.userId}`,
    { headers: { Authorization: `Bearer ${owner.token}` } },
  );
  expect(removeMemberOverrideRes.ok()).toBeTruthy();

  const overridesResAfter = await request.get(`http://127.0.0.1:4000/api/v1/channels/${targetChannel!.id}/permissions`, {
    headers: { Authorization: `Bearer ${owner.token}` },
  });
  expect(overridesResAfter.ok()).toBeTruthy();
  const overridesAfter = (await overridesResAfter.json()) as Array<{ targetId: string; targetType: string }>;
  expect(overridesAfter.some((o) => o.targetId === member.userId && o.targetType === 'user')).toBeFalsy();
});

test('server settings channel override filters can clear shown overrides only', async ({ page, request }) => {
  const owner = await registerUser(request, 'ovrfilt');
  const guest = await registerUser(request, 'ovrfiltg');
  const scope = await createGuildWithChannels(request, owner.token, {
    textChannels: ['ops-room'],
  });
  const targetChannel = scope.textChannels.find((channel) => channel.name === 'ops-room');
  expect(targetChannel).toBeTruthy();

  const inviteRes = await request.post(`http://127.0.0.1:4000/api/v1/invites/guilds/${scope.guildId}/invites`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { channelId: scope.generalChannelId },
  });
  expect(inviteRes.ok()).toBeTruthy();
  const invite = (await inviteRes.json()) as { code: string };
  const acceptRes = await request.post(`http://127.0.0.1:4000/api/v1/invites/${invite.code}`, {
    headers: { Authorization: `Bearer ${guest.token}` },
  });
  expect(acceptRes.ok()).toBeTruthy();

  const roleRes = await request.post(`http://127.0.0.1:4000/api/v1/guilds/${scope.guildId}/roles`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { name: `ops-${Date.now()}`, mentionable: true },
  });
  expect(roleRes.ok()).toBeTruthy();
  const role = (await roleRes.json()) as { id: string };

  const roleOverrideRes = await request.put(
    `http://127.0.0.1:4000/api/v1/channels/${targetChannel!.id}/permissions/${role.id}`,
    {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { type: 'role', allow: VIEW_CHANNEL_BIT, deny: '0' },
    },
  );
  expect(roleOverrideRes.ok()).toBeTruthy();

  const userOverrideRes = await request.put(
    `http://127.0.0.1:4000/api/v1/channels/${targetChannel!.id}/permissions/${guest.userId}`,
    {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { type: 'user', allow: VIEW_CHANNEL_BIT, deny: '0' },
    },
  );
  expect(userOverrideRes.ok()).toBeTruthy();

  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${targetChannel!.id}`);
  await page.locator('.channel-sidebar .channel-sidebar-guild-btn:visible').first().click();
  await page.locator('.channel-sidebar-dropdown').getByRole('button', { name: 'Portal Settings' }).click();
  const modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Channels' }).click();

  await modal.locator('select').first().selectOption(targetChannel!.id);
  await expect(modal.locator('.channel-permission-item')).toHaveCount(2, { timeout: 10000 });

  await modal.locator('.server-settings-inline-stats').getByRole('button', { name: 'Members' }).click();
  await expect(modal.locator('.channel-permission-item .channel-permission-badge', { hasText: 'Member' })).toHaveCount(1);

  page.once('dialog', (dialog) => dialog.accept());
  await modal.getByRole('button', { name: 'Clear Shown Overrides' }).click();

  await expect(modal.locator('.channel-permission-item .channel-permission-badge', { hasText: 'Member' })).toHaveCount(0);
  await modal.locator('.server-settings-inline-stats').getByRole('button', { name: 'Roles' }).click();
  await expect(modal.locator('.channel-permission-item .channel-permission-badge', { hasText: 'Role' })).toHaveCount(1);
});

test('server settings bans search and split clear override actions work for owners', async ({ page, request }) => {
  const owner = await registerUser(request, 'ovrban');
  const guestA = await registerUser(request, 'ovrbana');
  const guestB = await registerUser(request, 'ovrbanb');
  const scope = await createGuildWithChannels(request, owner.token, {
    textChannels: ['ops-room'],
  });
  const targetChannel = scope.textChannels.find((channel) => channel.name === 'ops-room');
  expect(targetChannel).toBeTruthy();

  for (const guest of [guestA, guestB]) {
    const inviteRes = await request.post(`http://127.0.0.1:4000/api/v1/invites/guilds/${scope.guildId}/invites`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { channelId: scope.generalChannelId },
    });
    expect(inviteRes.ok()).toBeTruthy();
    const invite = (await inviteRes.json()) as { code: string };
    const acceptRes = await request.post(`http://127.0.0.1:4000/api/v1/invites/${invite.code}`, {
      headers: { Authorization: `Bearer ${guest.token}` },
    });
    expect(acceptRes.ok()).toBeTruthy();
  }

  const roleRes = await request.post(`http://127.0.0.1:4000/api/v1/guilds/${scope.guildId}/roles`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { name: `ops-clear-${Date.now()}`, mentionable: true },
  });
  expect(roleRes.ok()).toBeTruthy();
  const role = (await roleRes.json()) as { id: string };

  const roleOverrideRes = await request.put(
    `http://127.0.0.1:4000/api/v1/channels/${targetChannel!.id}/permissions/${role.id}`,
    { headers: { Authorization: `Bearer ${owner.token}` }, data: { type: 'role', allow: VIEW_CHANNEL_BIT, deny: '0' } },
  );
  expect(roleOverrideRes.ok()).toBeTruthy();
  const userOverrideRes = await request.put(
    `http://127.0.0.1:4000/api/v1/channels/${targetChannel!.id}/permissions/${guestA.userId}`,
    { headers: { Authorization: `Bearer ${owner.token}` }, data: { type: 'user', allow: VIEW_CHANNEL_BIT, deny: '0' } },
  );
  expect(userOverrideRes.ok()).toBeTruthy();

  const banARes = await request.put(`http://127.0.0.1:4000/api/v1/guilds/${scope.guildId}/bans/${guestA.userId}`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { reason: 'Repeated spam links in portal announcements and direct pings' },
  });
  expect(banARes.ok()).toBeTruthy();
  const banBRes = await request.put(`http://127.0.0.1:4000/api/v1/guilds/${scope.guildId}/bans/${guestB.userId}`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { reason: 'Harassment' },
  });
  expect(banBRes.ok()).toBeTruthy();

  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${targetChannel!.id}`);
  await page.locator('.channel-sidebar .channel-sidebar-guild-btn:visible').first().click();
  await page.locator('.channel-sidebar-dropdown').getByRole('button', { name: 'Portal Settings' }).click();
  const modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();

  await modal.getByRole('button', { name: 'Channels' }).click();
  await modal.locator('select').first().selectOption(targetChannel!.id);
  await expect(modal.locator('.channel-permission-item')).toHaveCount(2, { timeout: 10000 });

  await modal.locator('.server-settings-inline-stats').getByRole('button', { name: 'Members' }).click();
  await expect(modal.locator('.channel-permission-item .channel-permission-badge', { hasText: 'Member' })).toHaveCount(1);

  await modal.getByRole('button', { name: 'Channels' }).click();
  await modal.locator('select').first().selectOption(targetChannel!.id);
  await modal.locator('.server-settings-inline-stats').getByRole('button', { name: 'Members' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await modal.getByRole('button', { name: 'Clear Shown Overrides' }).click();
  await expect(modal.locator('.channel-permission-item .channel-permission-badge', { hasText: 'Member' })).toHaveCount(0);
  await modal.locator('.server-settings-inline-stats').getByRole('button', { name: 'Roles' }).click();
  await expect(modal.locator('.channel-permission-item .channel-permission-badge', { hasText: 'Role' })).toHaveCount(1);

  page.once('dialog', (dialog) => dialog.accept());
  await modal.getByRole('button', { name: 'Clear All Overrides' }).click();
  await expect(modal.locator('.channel-permission-item')).toHaveCount(0);

  await modal.locator('.server-settings-tabs').getByRole('button', { name: 'Members', exact: true }).click();
  await expect(modal.locator('.channel-permission-item', { hasText: 'Reason:' })).toHaveCount(2);
  await modal.getByPlaceholder('Search banned users by name, username, ID, or reason').fill('Harassment');
  await expect(modal.locator('.channel-permission-item', { hasText: 'Harassment' })).toHaveCount(1);
});

test('server settings persists selected tab and channel permission filters per portal', async ({ page, request }) => {
  const owner = await registerUser(request, 'tabpersist');
  const scope = await createGuildWithChannels(request, owner.token, {
    textChannels: ['alpha-room', 'beta-room'],
  });
  const targetChannel = scope.textChannels.find((c) => c.name === 'alpha-room');
  expect(targetChannel).toBeTruthy();

  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${targetChannel!.id}`);
  await page.locator('.channel-sidebar .channel-sidebar-guild-btn:visible').first().click();
  await page.locator('.channel-sidebar-dropdown').getByRole('button', { name: 'Portal Settings' }).click();
  let modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();

  await modal.getByRole('button', { name: 'Channels' }).click();
  await modal.locator('input[placeholder=\"Filter channels\"]').fill('alpha');
  await modal.locator('select').first().selectOption(targetChannel!.id);
  await modal.getByPlaceholder('Filter overrides by role/member').fill('test');
  await modal.getByRole('button', { name: 'Members' }).first().click();
  await expect(modal.getByRole('button', { name: 'Members' })).toHaveClass(/server-settings-tab-active/);

  await modal.getByRole('button', { name: 'Close' }).click();
  await page.locator('.channel-sidebar .channel-sidebar-guild-btn:visible').first().click();
  await page.locator('.channel-sidebar-dropdown').getByRole('button', { name: 'Portal Settings' }).click();
  modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Members' })).toHaveClass(/server-settings-tab-active/);

  await modal.getByRole('button', { name: 'Channels' }).click();
  await expect(modal.locator('input[placeholder=\"Filter channels\"]')).toHaveValue('alpha');
  await expect(modal.getByPlaceholder('Filter overrides by role/member')).toHaveValue('test');
  await expect(modal.locator('select').first()).toHaveValue(targetChannel!.id);
});

test('server settings ban reason can expand and collapse for long reason', async ({ page, request }) => {
  const owner = await registerUser(request, 'banexpand');
  const guest = await registerUser(request, 'banexpandg');
  const scope = await createGuildWithChannels(request, owner.token, { textChannels: ['alpha-room'] });

  const inviteRes = await request.post(`http://127.0.0.1:4000/api/v1/invites/guilds/${scope.guildId}/invites`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { channelId: scope.generalChannelId },
  });
  expect(inviteRes.ok()).toBeTruthy();
  const invite = (await inviteRes.json()) as { code: string };
  await request.post(`http://127.0.0.1:4000/api/v1/invites/${invite.code}`, {
    headers: { Authorization: `Bearer ${guest.token}` },
  });

  const longReason = 'Long moderation reason '.repeat(12);
  const banRes = await request.put(`http://127.0.0.1:4000/api/v1/guilds/${scope.guildId}/bans/${guest.userId}`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { reason: longReason },
  });
  expect(banRes.ok()).toBeTruthy();

  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.textChannels[0]!.id}`);
  await page.locator('.channel-sidebar .channel-sidebar-guild-btn:visible').first().click();
  await page.locator('.channel-sidebar-dropdown').getByRole('button', { name: 'Portal Settings' }).click();
  const modal = page.locator('.modal-content');
  await modal.getByRole('button', { name: 'Members' }).click();
  await expect(modal.getByRole('button', { name: 'More' })).toBeVisible();
  await modal.getByRole('button', { name: 'More' }).click();
  await expect(modal.getByRole('button', { name: 'Less' })).toBeVisible();
});

test('server settings roles tab persists selected member context per portal', async ({ page, request }) => {
  const owner = await registerUser(request, 'rolepersist');
  const scope = await createGuildWithChannels(request, owner.token, { textChannels: ['alpha-room'] });

  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.textChannels[0]!.id}`);
  await page.locator('.channel-sidebar .channel-sidebar-guild-btn:visible').first().click();
  await page.locator('.channel-sidebar-dropdown').getByRole('button', { name: 'Portal Settings' }).click();
  let modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();

  await modal.getByRole('button', { name: 'Roles' }).click();
  await modal.getByPlaceholder('Filter members').fill('role');
  const memberSelect = modal.locator('select').nth(0);
  await memberSelect.selectOption({ index: 1 });
  await expect(modal.locator('.server-settings-stat-pill', { hasText: 'Managing member:' })).toBeVisible();

  await modal.getByRole('button', { name: 'Close' }).click();
  await page.locator('.channel-sidebar .channel-sidebar-guild-btn:visible').first().click();
  await page.locator('.channel-sidebar-dropdown').getByRole('button', { name: 'Portal Settings' }).click();
  modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Roles', exact: true })).toHaveClass(/server-settings-tab-active/);
  await expect(modal.locator('.server-settings-stat-pill', { hasText: 'Managing member:' })).toBeVisible();
  await expect(modal.getByPlaceholder('Filter members')).toHaveValue('role');

  await modal.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(modal.locator('.server-settings-stat-pill', { hasText: 'Managing member:' })).toHaveCount(0);
});

test('server settings persists admin list filters and sorts per portal', async ({ page, request }) => {
  const owner = await registerUser(request, 'adminpersist');
  const guest = await registerUser(request, 'adminpersistg');
  const scope = await createGuildWithChannels(request, owner.token, { textChannels: ['alpha-room'] });

  const inviteRes = await request.post(`http://127.0.0.1:4000/api/v1/invites/guilds/${scope.guildId}/invites`, {
    headers: { Authorization: `Bearer ${owner.token}` },
    data: { channelId: scope.generalChannelId },
  });
  expect(inviteRes.ok()).toBeTruthy();
  const invite = (await inviteRes.json()) as { code: string };
  await request.post(`http://127.0.0.1:4000/api/v1/invites/${invite.code}`, {
    headers: { Authorization: `Bearer ${guest.token}` },
  });

  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.textChannels[0]!.id}`);
  await page.locator('.channel-sidebar .channel-sidebar-guild-btn:visible').first().click();
  await page.locator('.channel-sidebar-dropdown').getByRole('button', { name: 'Portal Settings' }).click();
  let modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();

  const tabRail = modal.locator('.server-settings-tabs');
  await tabRail.getByRole('button', { name: 'Roles', exact: true }).click();
  await modal.getByRole('button', { name: 'Mentionable Only' }).click();
  await modal.getByPlaceholder('Filter roles').nth(1).fill('everyone');

  await tabRail.getByRole('button', { name: 'Members', exact: true }).click();
  await modal.getByRole('button', { name: 'Moderatable' }).click();
  await modal.getByPlaceholder('Search members by name or ID').fill('adminpersist');

  await modal.getByRole('button', { name: 'Close' }).click();
  await page.locator('.channel-sidebar .channel-sidebar-guild-btn:visible').first().click();
  await page.locator('.channel-sidebar-dropdown').getByRole('button', { name: 'Portal Settings' }).click();
  modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();

  await tabRail.getByRole('button', { name: 'Roles', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'Mentionable Only' })).toHaveClass(/active/);
  await expect(modal.getByPlaceholder('Filter roles').nth(1)).toHaveValue('everyone');

  await tabRail.getByRole('button', { name: 'Members', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'Moderatable' })).toHaveClass(/active/);
  await expect(modal.getByPlaceholder('Search members by name or ID')).toHaveValue('adminpersist');
});

test('server settings reset admin views clear persisted filters', async ({ page, request }) => {
  const owner = await registerUser(request, 'adminresetv');
  const scope = await createGuildWithChannels(request, owner.token, { textChannels: ['alpha-room'] });

  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.textChannels[0]!.id}`);
  await page.locator('.channel-sidebar .channel-sidebar-guild-btn:visible').first().click();
  await page.locator('.channel-sidebar-dropdown').getByRole('button', { name: 'Portal Settings' }).click();
  let modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();

  const tabRail = modal.locator('.server-settings-tabs');

  await tabRail.getByRole('button', { name: 'Channels', exact: true }).click();
  await modal.getByPlaceholder('Filter channels').fill('alpha');
  await modal.getByRole('button', { name: 'Reset Filters' }).click();
  await expect(modal.getByPlaceholder('Filter channels')).toHaveValue('');

  await tabRail.getByRole('button', { name: 'Roles', exact: true }).click();
  await modal.getByRole('button', { name: 'Mentionable Only' }).click();
  await modal.getByPlaceholder('Filter roles').nth(1).fill('everyone');
  await modal.getByRole('button', { name: 'Reset Role View' }).click();
  await expect(modal.getByRole('button', { name: 'All Roles' })).toHaveClass(/active/);
  await expect(modal.getByPlaceholder('Filter roles').nth(1)).toHaveValue('');

  await tabRail.getByRole('button', { name: 'Members', exact: true }).click();
  await modal.getByRole('button', { name: 'Moderatable' }).click();
  await modal.getByPlaceholder('Search members by name or ID').fill('adminresetv');
  await modal.getByRole('button', { name: 'Reset Member View' }).click();
  await expect(modal.getByRole('button', { name: 'All', exact: true })).toHaveClass(/active/);
  await expect(modal.getByPlaceholder('Search members by name or ID')).toHaveValue('');

  await modal.getByRole('button', { name: 'Close' }).click();
  await page.locator('.channel-sidebar .channel-sidebar-guild-btn:visible').first().click();
  await page.locator('.channel-sidebar-dropdown').getByRole('button', { name: 'Portal Settings' }).click();
  modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();

  await tabRail.getByRole('button', { name: 'Channels', exact: true }).click();
  await expect(modal.getByPlaceholder('Filter channels')).toHaveValue('');
  await tabRail.getByRole('button', { name: 'Roles', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'All Roles' })).toHaveClass(/active/);
  await expect(modal.getByPlaceholder('Filter roles').nth(1)).toHaveValue('');
  await tabRail.getByRole('button', { name: 'Members', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'All', exact: true })).toHaveClass(/active/);
  await expect(modal.getByPlaceholder('Search members by name or ID')).toHaveValue('');
});

test('server settings reset all admin views clears persisted admin state across tabs', async ({ page, request }) => {
  const owner = await registerUser(request, 'adminresetall');
  const scope = await createGuildWithChannels(request, owner.token, { textChannels: ['alpha-room'] });

  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.textChannels[0]!.id}`);
  await page.locator('.channel-sidebar .channel-sidebar-guild-btn:visible').first().click();
  await page.locator('.channel-sidebar-dropdown').getByRole('button', { name: 'Portal Settings' }).click();
  let modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();

  const tabRail = modal.locator('.server-settings-tabs');
  await tabRail.getByRole('button', { name: 'Channels', exact: true }).click();
  await modal.locator('select').first().selectOption(scope.textChannels[0]!.id);
  await modal.getByPlaceholder('Filter channels').fill('alpha');
  await modal.getByPlaceholder('Filter overrides by role/member').fill('abc');

  await tabRail.getByRole('button', { name: 'Roles', exact: true }).click();
  await modal.getByRole('button', { name: 'Mentionable Only' }).click();
  await modal.getByPlaceholder('Filter roles').nth(1).fill('everyone');

  await tabRail.getByRole('button', { name: 'Members', exact: true }).click();
  await modal.getByRole('button', { name: 'Moderatable' }).click();
  await modal.getByPlaceholder('Search members by name or ID').fill('adminresetall');

  await modal.getByRole('button', { name: 'Reset All Admin Views' }).click();
  await expect(modal.getByText('All admin views reset.').first()).toBeVisible();

  await tabRail.getByRole('button', { name: 'Channels', exact: true }).click();
  await expect(modal.getByPlaceholder('Filter channels')).toHaveValue('');
  await expect(modal.getByPlaceholder('Filter overrides by role/member')).toHaveValue('');
  await tabRail.getByRole('button', { name: 'Roles', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'All Roles' })).toHaveClass(/active/);
  await expect(modal.getByPlaceholder('Filter roles').nth(1)).toHaveValue('');
  await tabRail.getByRole('button', { name: 'Members', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'All', exact: true })).toHaveClass(/active/);
  await expect(modal.getByPlaceholder('Search members by name or ID')).toHaveValue('');

  await modal.getByRole('button', { name: 'Close' }).click();
  await page.locator('.channel-sidebar .channel-sidebar-guild-btn:visible').first().click();
  await page.locator('.channel-sidebar-dropdown').getByRole('button', { name: 'Portal Settings' }).click();
  modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();
  await tabRail.getByRole('button', { name: 'Channels', exact: true }).click();
  await expect(modal.getByPlaceholder('Filter channels')).toHaveValue('');
  await tabRail.getByRole('button', { name: 'Roles', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'All Roles' })).toHaveClass(/active/);
  await tabRail.getByRole('button', { name: 'Members', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'All', exact: true })).toHaveClass(/active/);
});

test('server settings shows copy id actions for admin workflows', async ({ page, request }) => {
  const owner = await registerUser(request, 'admincopyid');
  const scope = await createGuildWithChannels(request, owner.token, { textChannels: ['copy-room'] });

  await page.addInitScript(() => {
    const clipboard = {
      writeText: async () => {},
      readText: async () => '',
    };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard,
    });
  });
  await authenticateWithToken(page, owner.token);
  await page.goto(`/guild/${scope.guildId}/channel/${scope.textChannels[0]!.id}`);
  await page.locator('.channel-sidebar .channel-sidebar-guild-btn:visible').first().click();
  await page.locator('.channel-sidebar-dropdown').getByRole('button', { name: 'Portal Settings' }).click();
  const modal = page.locator('.modal-content');
  await expect(modal).toBeVisible();

  const tabRail = modal.locator('.server-settings-tabs');
  await tabRail.getByRole('button', { name: 'Channels', exact: true }).click();
  await modal.locator('select').first().selectOption(scope.textChannels[0]!.id);
  await expect(modal.getByText('Channel Permissions')).toBeVisible();

  await tabRail.getByRole('button', { name: 'Roles', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'Copy ID' }).first()).toBeVisible();

  await tabRail.getByRole('button', { name: 'Members', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'Copy ID' }).first()).toBeVisible();
});
