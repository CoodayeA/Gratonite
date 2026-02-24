import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';
import { bigintString } from './helpers';

// ============================================================================
// Shop System Tables
// ============================================================================

// Shop items catalog
export const shopItems = pgTable('shop_items', {
  id: bigintString('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull(), // 'avatar_decoration', 'profile_effect', 'nameplate'
  category: varchar('category', { length: 50 }).notNull(), // 'featured', 'avatar_decorations', etc.
  price: integer('price').notNull(),
  assetHash: varchar('asset_hash', { length: 64 }),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  isActive: boolean('is_active').notNull().default(true),
  isFeatured: boolean('is_featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// User inventory (purchased items)
export const userInventory = pgTable('user_inventory', {
  id: bigintString('id').primaryKey(),
  userId: bigintString('user_id')
    .notNull()
    .references(() => require('./users').users.id, { onDelete: 'cascade' }),
  itemId: bigintString('item_id')
    .notNull()
    .references(() => shopItems.id, { onDelete: 'restrict' }),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
  isEquipped: boolean('is_equipped').notNull().default(false),
  equippedAt: timestamp('equipped_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Shop purchase history
export const shopPurchases = pgTable('shop_purchases', {
  id: bigintString('id').primaryKey(),
  userId: bigintString('user_id')
    .notNull()
    .references(() => require('./users').users.id, { onDelete: 'cascade' }),
  itemId: bigintString('item_id')
    .notNull()
    .references(() => shopItems.id, { onDelete: 'restrict' }),
  price: integer('price').notNull(),
  currency: varchar('currency', { length: 20 }).notNull().default('gratonites'),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
});
