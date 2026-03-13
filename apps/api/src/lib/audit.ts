/**
 * lib/audit.ts — Audit logging helper for guild administrative actions.
 *
 * Provides a logAuditEvent() function that inserts a row into the audit_log
 * table. Exported so any route file can call it after performing a loggable
 * action.
 *
 * @module lib/audit
 */

import { db } from '../db/index';
import { logger } from './logger';
import { auditLog } from '../db/schema/audit';

// ---------------------------------------------------------------------------
// Action type constants
// ---------------------------------------------------------------------------

export const AuditActionTypes = {
  // Channel actions
  CHANNEL_CREATE: 'CHANNEL_CREATE',
  CHANNEL_UPDATE: 'CHANNEL_UPDATE',
  CHANNEL_DELETE: 'CHANNEL_DELETE',

  // Role actions
  ROLE_CREATE: 'ROLE_CREATE',
  ROLE_UPDATE: 'ROLE_UPDATE',
  ROLE_DELETE: 'ROLE_DELETE',

  // Member actions
  MEMBER_KICK: 'MEMBER_KICK',
  MEMBER_BAN: 'MEMBER_BAN',
  MEMBER_UNBAN: 'MEMBER_UNBAN',

  // Guild settings
  GUILD_UPDATE: 'GUILD_UPDATE',
} as const;

export type AuditActionType = (typeof AuditActionTypes)[keyof typeof AuditActionTypes];

// ---------------------------------------------------------------------------
// Target type constants
// ---------------------------------------------------------------------------

export const AuditTargetTypes = {
  CHANNEL: 'CHANNEL',
  ROLE: 'ROLE',
  USER: 'USER',
  GUILD: 'GUILD',
} as const;

export type AuditTargetType = (typeof AuditTargetTypes)[keyof typeof AuditTargetTypes];

// ---------------------------------------------------------------------------
// logAuditEvent — fire-and-forget audit logger
// ---------------------------------------------------------------------------

/**
 * Insert a row into the audit_log table.
 *
 * This function intentionally swallows errors — audit logging should never
 * block or fail the primary operation.
 *
 * @param guildId    - The guild where the action occurred.
 * @param userId     - The user who performed the action.
 * @param action     - One of the AuditActionTypes constants.
 * @param targetId   - UUID of the entity that was acted upon (channel, role, user, etc.).
 * @param targetType - The type of the target entity.
 * @param changes    - Optional JSON blob describing what changed.
 * @param reason     - Optional human-readable reason for the action.
 */
export async function logAuditEvent(
  guildId: string,
  userId: string,
  action: AuditActionType,
  targetId?: string | null,
  targetType?: AuditTargetType | null,
  changes?: Record<string, unknown> | null,
  reason?: string | null,
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      guildId,
      userId,
      action,
      targetId: targetId ?? null,
      targetType: targetType ?? null,
      changes: changes ?? null,
      reason: reason ?? null,
    });
  } catch (err) {
    // Audit logging should never break the primary operation.
    logger.error('[audit] Failed to log event:', err);
  }
}
