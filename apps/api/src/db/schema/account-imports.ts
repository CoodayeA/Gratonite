/** account-imports.ts — Drizzle ORM schema for cross-instance account import requests. */

import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { federatedInstances } from './federation-instances';

export const accountImports = pgTable('account_imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourceInstanceId: uuid('source_instance_id').references(() => federatedInstances.id, { onDelete: 'set null' }),
  sourceFederationAddress: varchar('source_federation_address', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  importedData: jsonb('imported_data').default(sql`'{}'::jsonb`),
  verificationProof: text('verification_proof'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AccountImport = typeof accountImports.$inferSelect;
export type NewAccountImport = typeof accountImports.$inferInsert;
