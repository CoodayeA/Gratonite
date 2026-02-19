import { GRATONITE_EPOCH } from '@gratonite/types';

/**
 * Server-side snowflake generator.
 * Thread-safe via closure (single worker assumption for now).
 * When scaling to multiple workers, pass unique workerId/processId.
 */

let sequence = 0;
let lastTimestamp = -1n;

const WORKER_ID = BigInt(process.env['WORKER_ID'] ?? 1) & 0x1fn;
const PROCESS_ID = BigInt(process.env['PROCESS_ID'] ?? 1) & 0x1fn;

export function generateId(): bigint {
  let timestamp = BigInt(Date.now()) - GRATONITE_EPOCH;

  if (timestamp === lastTimestamp) {
    sequence = (sequence + 1) & 0xfff;
    if (sequence === 0) {
      // Sequence exhausted for this ms — wait for next ms
      while (timestamp <= lastTimestamp) {
        timestamp = BigInt(Date.now()) - GRATONITE_EPOCH;
      }
    }
  } else {
    sequence = 0;
  }

  lastTimestamp = timestamp;

  return (
    (timestamp << 22n) |
    (WORKER_ID << 17n) |
    (PROCESS_ID << 12n) |
    BigInt(sequence)
  );
}

/** Generate a snowflake ID as a string (for JSON serialization) */
export function generateIdString(): string {
  return generateId().toString();
}
