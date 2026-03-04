/**
 * shop.ts — Drizzle ORM schemas for shop_items and user_inventory tables.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// ---------------------------------------------------------------------------
// shop_items
// ---------------------------------------------------------------------------

export const shopItems = pgTable('shop_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  price: integer('price').notNull().default(0),
  category: varchar('category', { length: 64 }),
  imageUrl: varchar('image_url', { length: 512 }),
  rarity: varchar('rarity', { length: 32 }).notNull().default('common'),
  available: boolean('available').notNull().default(true),
  // Cosmetic type fields (added for cosmetic shop items)
  type: varchar('type', { length: 32 }), // 'avatar_frame' | 'decoration' | 'profile_effect' | 'nameplate' | 'soundboard'
  assetUrl: varchar('asset_url', { length: 512 }), // CDN/local path to asset file
  assetConfig: jsonb('asset_config'), // config-based editor output (null for uploaded assets)
  duration: integer('duration'), // soundboard only: length in seconds (1–10)
  metadata: jsonb('metadata'), // type-specific extra data
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ShopItem = typeof shopItems.$inferSelect;
export type NewShopItem = typeof shopItems.$inferInsert;

// ---------------------------------------------------------------------------
// user_inventory
// ---------------------------------------------------------------------------

export const userInventory = pgTable('user_inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').notNull().references(() => shopItems.id, { onDelete: 'cascade' }),
  equipped: boolean('equipped').notNull().default(false),
  acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserInventoryRow = typeof userInventory.$inferSelect;
export type NewUserInventoryRow = typeof userInventory.$inferInsert;

// ---------------------------------------------------------------------------
// user_soundboard — personal soundboard library (soundboard-type shop items)
// ---------------------------------------------------------------------------

export const userSoundboard = pgTable(
  'user_soundboard',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').notNull().references(() => shopItems.id, { onDelete: 'cascade' }),
    acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('user_soundboard_user_item_key').on(table.userId, table.itemId),
  ],
);

export type UserSoundboardRow = typeof userSoundboard.$inferSelect;
export type NewUserSoundboardRow = typeof userSoundboard.$inferInsert;

export const shopPurchaseRequests = pgTable(
  'shop_purchase_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    itemId: uuid('item_id').notNull().references(() => shopItems.id, { onDelete: 'cascade' }),
    responseJson: jsonb('response_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('shop_purchase_requests_user_key').on(table.userId, table.idempotencyKey),
  ],
);

export type ShopPurchaseRequest = typeof shopPurchaseRequests.$inferSelect;
