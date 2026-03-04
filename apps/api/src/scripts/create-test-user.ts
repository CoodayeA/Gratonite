import 'dotenv/config';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';

import { db } from '../db';
import { users } from '../db/schema/users';

function envOrDefault(key: string, fallback: string): string {
  const value = (process.env[key] ?? '').trim();
  return value.length > 0 ? value : fallback;
}

async function main(): Promise<void> {
  const suffix = Date.now().toString().slice(-6);
  const username = envOrDefault('TEST_USER_USERNAME', `testuser${suffix}`).slice(0, 32);
  const email = envOrDefault('TEST_USER_EMAIL', `${username}@gratonite.test`).toLowerCase();
  const password = envOrDefault('TEST_USER_PASSWORD', `TestUser!${suffix}`);
  const displayName = envOrDefault('TEST_USER_DISPLAY_NAME', `Test User ${suffix}`);

  const existingByEmail = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existingByEmail.length > 0) {
    throw new Error(`User with email ${email} already exists. Set TEST_USER_EMAIL to create a different user.`);
  }

  const existingByUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existingByUsername.length > 0) {
    throw new Error(`User with username ${username} already exists. Set TEST_USER_USERNAME to create a different user.`);
  }

  const passwordHash = await argon2.hash(password);

  const [created] = await db
    .insert(users)
    .values({
      username,
      email,
      passwordHash,
      displayName,
      emailVerified: true,
      onboardingCompleted: true,
      status: 'online',
      isAdmin: false,
      mfaEnabled: false,
      mfaSecret: null,
      interests: JSON.stringify(['testing', 'qa']),
      customStatus: 'Testing Gratonite',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      displayName: users.displayName,
      emailVerified: users.emailVerified,
    });

  console.log('[create-test-user] created');
  console.log(JSON.stringify({
    id: created.id,
    username: created.username,
    email: created.email,
    displayName: created.displayName,
    emailVerified: created.emailVerified,
    password,
  }, null, 2));
}

main().catch((err) => {
  console.error('[create-test-user] failed:', err);
  process.exit(1);
});
