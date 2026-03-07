import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { sql } from 'drizzle-orm';

export const oauthApps = pgTable('oauth_apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  iconHash: text('icon_hash'),
  clientId: text('client_id').notNull().unique().default(sql`gen_random_uuid()::text`),
  clientSecretHash: text('client_secret_hash').notNull(),
  redirectUris: text('redirect_uris').array().notNull().default(sql`'{}'::text[]`),
  scopes: text('scopes').array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const oauthTokens = pgTable('oauth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  appId: uuid('app_id').notNull().references(() => oauthApps.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessTokenHash: text('access_token_hash').notNull().unique(),
  refreshTokenHash: text('refresh_token_hash').notNull().unique(),
  scopes: text('scopes').array().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type OAuthApp = typeof oauthApps.$inferSelect;
export type OAuthToken = typeof oauthTokens.$inferSelect;
