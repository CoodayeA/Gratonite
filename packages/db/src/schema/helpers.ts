import { customType } from 'drizzle-orm/pg-core';

/**
 * Custom bigint column that returns JavaScript strings instead of BigInt.
 *
 * PostgreSQL's `bigint` type exceeds Number.MAX_SAFE_INTEGER, so we can't
 * use JS numbers. Drizzle's built-in `bigint({ mode: 'bigint' })` returns
 * JS BigInt which can't be JSON.stringify'd. This custom type stores as
 * PostgreSQL `bigint` but maps to/from JS strings — safe for JSON, JWT,
 * and API responses.
 */
export const bigintString = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'bigint';
  },
  fromDriver(value: string): string {
    return String(value);
  },
  toDriver(value: string): string {
    return value;
  },
});
