import { db } from '../db/index';
import { logger } from './logger';
import { adminAuditLog } from '../db/schema/admin';

type LogAdminAuditParams = {
  actorId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Best-effort global admin audit logger.
 * Failures are intentionally swallowed to avoid breaking the primary action.
 */
export async function logAdminAudit(params: LogAdminAuditParams): Promise<void> {
  try {
    await db.insert(adminAuditLog).values({
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      description: params.description ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    logger.error('[admin-audit] Failed to write audit event:', err);
  }
}
