import 'dotenv/config';

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { eq, inArray } from 'drizzle-orm';

import { db } from '../db/index';
import { guildsRouter } from '../routes/guilds';
import { signAccessToken } from '../lib/jwt';
import { users } from '../db/schema/users';
import { guildMembers, guilds } from '../db/schema/guilds';
import { redis } from '../lib/redis';

async function main(): Promise<void> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const memberUsername = `guild_contract_member_${suffix}`;
  const outsiderUsername = `guild_contract_outsider_${suffix}`;

  const createdUsers = await db
    .insert(users)
    .values([
      {
        username: memberUsername,
        email: `${memberUsername}@example.com`,
        passwordHash: 'contract-test-hash',
        displayName: 'Guild Contract Member',
      },
      {
        username: outsiderUsername,
        email: `${outsiderUsername}@example.com`,
        passwordHash: 'contract-test-hash',
        displayName: 'Guild Contract Outsider',
      },
    ])
    .returning({ id: users.id, username: users.username });

  const memberId = createdUsers.find((u) => u.username === memberUsername)?.id;
  const outsiderId = createdUsers.find((u) => u.username === outsiderUsername)?.id;
  assert.ok(memberId, 'member user was not created');
  assert.ok(outsiderId, 'outsider user was not created');

  const [guild] = await db.select({ id: guilds.id }).from(guilds).limit(1);
  assert.ok(guild?.id, 'no guild exists to run guild-get contract test');

  await db.insert(guildMembers).values({
    guildId: guild.id,
    userId: memberId,
  });

  const app = express();
  app.use(express.json());
  app.use('/api/v1/guilds', guildsRouter);

  const server = await new Promise<import('node:http').Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object' && 'port' in address, 'server did not start');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const memberToken = signAccessToken(memberId);
  const outsiderToken = signAccessToken(outsiderId);

  try {
    const memberRes = await fetch(`${baseUrl}/api/v1/guilds/${guild.id}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert.equal(memberRes.status, 200, 'expected 200 for member guild fetch');

    const outsiderRes = await fetch(`${baseUrl}/api/v1/guilds/${guild.id}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    assert.equal(outsiderRes.status, 403, 'expected 403 for non-member guild fetch');
    const outsiderBody = (await outsiderRes.json()) as { code?: string };
    assert.equal(outsiderBody.code, 'FORBIDDEN', 'expected FORBIDDEN code for non-member guild fetch');

    const unknownGuildId = crypto.randomUUID();
    const unknownRes = await fetch(`${baseUrl}/api/v1/guilds/${unknownGuildId}`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert.equal(unknownRes.status, 404, 'expected 404 for unknown guild fetch');
    const unknownBody = (await unknownRes.json()) as { code?: string };
    assert.equal(unknownBody.code, 'NOT_FOUND', 'expected NOT_FOUND code for unknown guild fetch');

    console.info('guild-get contract test passed');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await db
      .delete(guildMembers)
      .where(eq(guildMembers.userId, memberId));
    await db.delete(users).where(inArray(users.id, [memberId, outsiderId]));
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
