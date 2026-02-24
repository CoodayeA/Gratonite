import { expect, test } from '@playwright/test';
import { registerUser } from './helpers';

test('community shop lifecycle: draft -> submit -> report, with moderation/install guards', async ({ request }) => {
  const creator = await registerUser(request, 'shopcreator');
  const reporter = await registerUser(request, 'shopreporter');

  const createRes = await request.post('http://127.0.0.1:4000/api/v1/community-items', {
    headers: { Authorization: `Bearer ${creator.token}` },
    data: {
      itemType: 'display_name_style_pack',
      name: 'E2E Style Pack',
      description: 'Test-created pack',
      payload: { font: 'tempo', effect: 'gradient' },
      tags: ['e2e', 'style'],
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const created = (await createRes.json()) as { id: string; status: string; uploaderId: string };
  expect(created.status).toBe('draft');
  expect(created.uploaderId).toBe(creator.userId);

  const submitRes = await request.post(`http://127.0.0.1:4000/api/v1/community-items/${created.id}/submit`, {
    headers: { Authorization: `Bearer ${creator.token}` },
  });
  expect(submitRes.ok()).toBeTruthy();
  const submitted = (await submitRes.json()) as { status: string };
  expect(submitted.status).toBe('pending_review');

  const moderationQueueForbidden = await request.get('http://127.0.0.1:4000/api/v1/community-items/moderation/queue', {
    headers: { Authorization: `Bearer ${creator.token}` },
  });
  expect(moderationQueueForbidden.status()).toBe(403);

  const reportRes = await request.post(`http://127.0.0.1:4000/api/v1/community-items/${created.id}/report`, {
    headers: { Authorization: `Bearer ${reporter.token}` },
    data: {
      reason: 'LOW_QUALITY',
      details: 'E2E report payload',
    },
  });
  expect(reportRes.status()).toBe(201);

  const installUnavailable = await request.post(`http://127.0.0.1:4000/api/v1/community-items/${created.id}/install`, {
    headers: { Authorization: `Bearer ${creator.token}` },
    data: { scope: 'global' },
  });
  expect(installUnavailable.status()).toBe(404);

  const mineRes = await request.get('http://127.0.0.1:4000/api/v1/users/@me/community-items', {
    headers: { Authorization: `Bearer ${creator.token}` },
  });
  expect(mineRes.ok()).toBeTruthy();
  const mine = (await mineRes.json()) as { created: Array<{ id: string; status: string }> };
  const mineItem = mine.created.find((item) => item.id === created.id);
  expect(mineItem).toBeTruthy();
  expect(mineItem?.status).toBe('pending_review');

  const publicBrowse = await request.get('http://127.0.0.1:4000/api/v1/community-items');
  expect(publicBrowse.ok()).toBeTruthy();
  const publicItems = (await publicBrowse.json()) as Array<{ id: string }>;
  expect(publicItems.some((item) => item.id === created.id)).toBeFalsy();
});
