import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { bigintString } from './helpers';

// ============================================================================
// Enums
// ============================================================================

export const cosmeticTypeEnum = pgEnum('cosmetic_type', [
  'avatar_decoration',
  'effect',
  'nameplate',
  'soundboard',
]);

// ============================================================================
// Creator Marketplace Tables
// ============================================================================

// User-created cosmetics available for purchase in the marketplace
export const cosmetics = pgTable(
  'cosmetics',
  {
    id: bigintString('id').primaryKey(),
    creatorId: bigintString('creator_id')
      .notNull()
      .references(() => require('./users').users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    type: cosmeticTypeEnum('type').notNull(),
    previewImageUrl: text('preview_image_url'),
    assetUrl: text('asset_url'),
    price: integer('price').notNull().default(0),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    creatorIdIdx: index('cosmetics_creator_id_idx').on(table.creatorId),
    typeIdx: index('cosmetics_type_idx').on(table.type),
    isPublishedIdx: index('cosmetics_is_published_idx').on(table.isPublished),
  }),
);

// Records of users who have purchased cosmetics
export const cosmeticPurchases = pgTable(
  'cosmetic_purchases',
  {
    id: bigintString('id').primaryKey(),
    userId: bigintString('user_id')
      .notNull()
      .references(() => require('./users').users.id, { onDelete: 'cascade' }),
    cosmeticId: bigintString('cosmetic_id')
      .notNull()
      .references(() => cosmetics.id, { onDelete: 'restrict' }),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
    isEquipped: boolean('is_equipped').notNull().default(false),
  },
  (table) => ({
    userIdIdx: index('cosmetic_purchases_user_id_idx').on(table.userId),
    cosmeticIdIdx: index('cosmetic_purchases_cosmetic_id_idx').on(table.cosmeticId),
  }),
);
