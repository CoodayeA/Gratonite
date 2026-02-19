// ============================================================================
// Snowflake ID system — Twitter-style distributed unique IDs
// 64-bit: timestamp(42) + worker(5) + process(5) + sequence(12)
// ============================================================================

/** Snowflake ID represented as a string (too large for JS number) */
export type Snowflake = string;

/** Gratonite epoch: January 1, 2025 00:00:00 UTC */
export const GRATONITE_EPOCH = 1735689600000n;

/** Extract timestamp from a snowflake ID */
export function snowflakeToTimestamp(id: Snowflake): Date {
  const snowflake = BigInt(id);
  const timestamp = (snowflake >> 22n) + GRATONITE_EPOCH;
  return new Date(Number(timestamp));
}

/** Generate a snowflake ID (server-side only — needs worker/process IDs) */
export function generateSnowflake(
  workerId: number,
  processId: number,
  sequence: number,
  timestamp?: number,
): Snowflake {
  const ts = BigInt(timestamp ?? Date.now()) - GRATONITE_EPOCH;
  const snowflake =
    (ts << 22n) |
    (BigInt(workerId & 0x1f) << 17n) |
    (BigInt(processId & 0x1f) << 12n) |
    BigInt(sequence & 0xfff);
  return snowflake.toString();
}

/** Validate that a string is a valid snowflake format */
export function isValidSnowflake(value: string): value is Snowflake {
  if (!/^\d{1,20}$/.test(value)) return false;
  try {
    const n = BigInt(value);
    return n > 0n && n < (1n << 64n);
  } catch {
    return false;
  }
}
