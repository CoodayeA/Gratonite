import { expect, test } from '@playwright/test';
import { registerUser } from './helpers';

const API = (process.env['PW_API_ORIGIN'] ?? 'http://127.0.0.1:4000').replace(/\/+$/, '') + '/api/v1';

test.describe('Cosmetics purchase flow', () => {
  test('creator can create cosmetic and buyer can purchase + equip it', async ({ request }) => {
    const creator = await registerUser(request, 'coscreat');
    const buyer = await registerUser(request, 'cosbuyer');

    // ── Create a free cosmetic as creator ─────────────────────────────
    const createRes = await request.post(`${API}/cosmetics`, {
      headers: { Authorization: `Bearer ${creator.token}` },
      data: {
        name: 'Test Halo',
        description: 'E2E test decoration',
        type: 'avatar_decoration',
        price: 0,
      },
    });
    expect(createRes.ok(), `create cosmetic: ${await createRes.text()}`).toBeTruthy();
    const cosmetic = (await createRes.json()) as { id: string; isPublished: boolean };
    expect(cosmetic.isPublished).toBe(false);

    // ── Publish it ────────────────────────────────────────────────────
    const publishRes = await request.patch(`${API}/cosmetics/${cosmetic.id}`, {
      headers: { Authorization: `Bearer ${creator.token}` },
      data: { isPublished: true },
    });
    expect(publishRes.ok(), `publish cosmetic: ${await publishRes.text()}`).toBeTruthy();
    const published = (await publishRes.json()) as { isPublished: boolean };
    expect(published.isPublished).toBe(true);

    // ── Marketplace returns it ────────────────────────────────────────
    const marketRes = await request.get(`${API}/cosmetics/marketplace`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
    });
    expect(marketRes.ok()).toBeTruthy();
    const market = (await marketRes.json()) as Array<{ id: string }>;
    expect(market.some((c) => c.id === cosmetic.id)).toBeTruthy();

    // ── Buyer purchases ───────────────────────────────────────────────
    const buyRes = await request.post(`${API}/cosmetics/${cosmetic.id}/purchase`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
    });
    expect(buyRes.ok(), `purchase cosmetic: ${await buyRes.text()}`).toBeTruthy();
    const purchase = (await buyRes.json()) as { id: string; isEquipped: boolean };
    expect(purchase.isEquipped).toBe(false);
    const purchaseId = purchase.id;

    // ── Double-purchase returns error ─────────────────────────────────
    const dupRes = await request.post(`${API}/cosmetics/${cosmetic.id}/purchase`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
    });
    expect(dupRes.status()).toBe(409);

    // ── Buyer equips it ───────────────────────────────────────────────
    const equipRes = await request.patch(`${API}/cosmetics/${cosmetic.id}/equip`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
    });
    expect(equipRes.ok(), `equip cosmetic: ${await equipRes.text()}`).toBeTruthy();

    // ── GET equipped returns it ───────────────────────────────────────
    const equippedRes = await request.get(`${API}/users/@me/equipped-cosmetics`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
    });
    expect(equippedRes.ok()).toBeTruthy();
    const equipped = (await equippedRes.json()) as Array<{ id: string }>;
    expect(equipped.some((c) => c.id === cosmetic.id)).toBeTruthy();

    // ── Buyer unequips it ────────────────────────────────────────────
    const unequipRes = await request.delete(`${API}/cosmetics/${cosmetic.id}/equip`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
    });
    expect(unequipRes.ok(), `unequip cosmetic: ${await unequipRes.text()}`).toBeTruthy();

    // ── Equipped list is now empty ────────────────────────────────────
    const postUnequip = await request.get(`${API}/users/@me/equipped-cosmetics`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
    });
    expect(postUnequip.ok()).toBeTruthy();
    const afterUnequip = (await postUnequip.json()) as Array<{ id: string }>;
    expect(afterUnequip.some((c) => c.id === cosmetic.id)).toBeFalsy();

    // ── Creator views stats ───────────────────────────────────────────
    const statsRes = await request.get(`${API}/cosmetics/${cosmetic.id}/stats`, {
      headers: { Authorization: `Bearer ${creator.token}` },
    });
    expect(statsRes.ok()).toBeTruthy();
    const stats = (await statsRes.json()) as { salesCount: number };
    expect(stats.salesCount).toBeGreaterThanOrEqual(1);

    // ── Creator deletes cosmetic ──────────────────────────────────────
    const deleteRes = await request.delete(`${API}/cosmetics/${cosmetic.id}`, {
      headers: { Authorization: `Bearer ${creator.token}` },
    });
    expect(deleteRes.ok(), `delete cosmetic: ${await deleteRes.text()}`).toBeTruthy();

    // ── Creator's list is now empty ───────────────────────────────────
    const creatorListRes = await request.get(`${API}/cosmetics/creator/${creator.userId}`, {
      headers: { Authorization: `Bearer ${creator.token}` },
    });
    expect(creatorListRes.ok()).toBeTruthy();
    const creatorList = (await creatorListRes.json()) as Array<{ id: string }>;
    expect(creatorList.some((c) => c.id === cosmetic.id)).toBeFalsy();
  });

  test('non-owner cannot edit cosmetic', async ({ request }) => {
    const owner = await registerUser(request, 'cosown');
    const other = await registerUser(request, 'cosother');

    const createRes = await request.post(`${API}/cosmetics`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { name: 'Owner Only', type: 'nameplate', price: 0 },
    });
    expect(createRes.ok()).toBeTruthy();
    const { id } = (await createRes.json()) as { id: string };

    const editRes = await request.patch(`${API}/cosmetics/${id}`, {
      headers: { Authorization: `Bearer ${other.token}` },
      data: { name: 'Hacked' },
    });
    expect(editRes.status()).toBe(403);
  });

  test('purchasing unowned cosmetic returns 404', async ({ request }) => {
    const buyer = await registerUser(request, 'cosbuy2');
    const res = await request.post(`${API}/cosmetics/999999999999/purchase`, {
      headers: { Authorization: `Bearer ${buyer.token}` },
    });
    expect([404, 400]).toContain(res.status());
  });
});
