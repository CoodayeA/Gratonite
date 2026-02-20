import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { bigintString } from './helpers';
import { users } from './users';
import { guilds } from './guilds';

// ==========================================================================
// Enums
// ==========================================================================

export const oauthTokenTypeEnum = pgEnum('oauth_token_type', ['access', 'refresh', 'bot']);

// ==========================================================================
// OAuth2 Applications
// ==========================================================================

export const oauth2Apps = pgTable('oauth2_apps', {
  id: bigintString('id').primaryKey(),
  ownerId: bigintString('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 200 }),
  iconHash: varchar('icon_hash', { length: 64 }),
  clientSecretHash: text('client_secret_hash').notNull(),
  redirectUris: jsonb('redirect_uris').notNull().default([]),
  botPublic: boolean('bot_public').notNull().default(true),
  botRequireCodeGrant: boolean('bot_require_code_grant').notNull().default(true),
  termsUrl: varchar('terms_url', { length: 200 }),
  privacyUrl: varchar('privacy_url', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ==========================================================================
// OAuth2 Authorization Codes
// ==========================================================================

export const oauth2Codes = pgTable('oauth2_codes', {
  code: varchar('code', { length: 128 }).primaryKey(),
  applicationId: bigintString('application_id')
    .notNull()
    .references(() => oauth2Apps.id, { onDelete: 'cascade' }),
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  redirectUri: varchar('redirect_uri', { length: 200 }).notNull(),
  scopes: jsonb('scopes').notNull().default([]),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ==========================================================================
// OAuth2 Tokens (access/refresh/bot)
// ==========================================================================

export const oauth2Tokens = pgTable('oauth2_tokens', {
  id: bigintString('id').primaryKey(),
  applicationId: bigintString('application_id')
    .notNull()
    .references(() => oauth2Apps.id, { onDelete: 'cascade' }),
  userId: bigintString('user_id').references(() => users.id, { onDelete: 'cascade' }),
  tokenType: oauthTokenTypeEnum('token_type').notNull(),
  tokenHash: text('token_hash').notNull(),
  scopes: jsonb('scopes').notNull().default([]),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revoked: boolean('revoked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ==========================================================================
// Bots (application-bound)
// ==========================================================================

export const bots = pgTable('bots', {
  applicationId: bigintString('application_id')
    .primaryKey()
    .references(() => oauth2Apps.id, { onDelete: 'cascade' }),
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  public: boolean('public').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ==========================================================================
// Slash commands
// ==========================================================================

export const slashCommands = pgTable('slash_commands', {
  id: bigintString('id').primaryKey(),
  applicationId: bigintString('application_id')
    .notNull()
    .references(() => oauth2Apps.id, { onDelete: 'cascade' }),
  guildId: bigintString('guild_id').references(() => guilds.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 32 }).notNull(),
  description: varchar('description', { length: 100 }).notNull(),
  options: jsonb('options').notNull().default([]),
  defaultMemberPermissions: varchar('default_member_permissions', { length: 32 }).default('0'),
  dmPermission: boolean('dm_permission').notNull().default(true),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
