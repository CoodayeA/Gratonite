/**
 * auctions.ts — Drizzle ORM schemas for auctions and auction_bids tables.
 *
 * Escrow model: currency is deducted when a bid is placed and refunded
 * immediately when outbid. This prevents overbidding.
 */

import {
  pgTable,
  uuid,
  integer,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { cosmetics } from './cosmetics';

// ---------------------------------------------------------------------------
// auctions
// ---------------------------------------------------------------------------

export const auctions = pgTable('auctions', {
  id: uuid('id').primaryKey().defaultRandom(),
  cosmeticId: uuid('cosmetic_id').notNull().references(() => cosmetics.id, { onDelete: 'cascade' }),
  sellerId: uuid('seller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startingPrice: integer('starting_price').notNull(),
  reservePrice: integer('reserve_price'), // optional minimum to sell
  currentBid: integer('current_bid'), // null if no bids yet
  currentBidderId: uuid('current_bidder_id').references(() => users.id, { onDelete: 'set null' }),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('active'), // 'active' | 'ended' | 'cancelled'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Auction = typeof auctions.$inferSelect;
export type NewAuction = typeof auctions.$inferInsert;

// ---------------------------------------------------------------------------
// auction_bids
// ---------------------------------------------------------------------------

export const auctionBids = pgTable(
  'auction_bids',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    auctionId: uuid('auction_id').notNull().references(() => auctions.id, { onDelete: 'cascade' }),
    bidderId: uuid('bidder_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('auction_bids_auction_amount_idx').on(table.auctionId, table.amount),
  ],
);

export type AuctionBid = typeof auctionBids.$inferSelect;
export type NewAuctionBid = typeof auctionBids.$inferInsert;
