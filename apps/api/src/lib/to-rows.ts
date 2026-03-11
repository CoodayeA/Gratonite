/**
 * toRows — Normalize the result of `db.execute()` into a plain array of rows.
 *
 * Drizzle's `db.execute(sql`...`)` returns different shapes depending on the
 * underlying driver (node-postgres returns `{ rows: T[] }`, while some drivers
 * return the array directly). This helper handles both cases so callers don't
 * need `as any` casts.
 *
 * @typeParam T — The expected row shape. Defaults to `Record<string, unknown>`.
 * @param result — The raw result from `db.execute()`.
 * @returns A typed array of rows.
 */
export function toRows<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}
