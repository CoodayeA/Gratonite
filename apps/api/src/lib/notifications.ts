/**
 * lib/notifications.ts — Helper to create and emit notifications.
 *
 * Usage:
 *   import { createNotification } from '../lib/notifications';
 *   await createNotification({
 *     userId: targetUserId,
 *     type: 'friend_request',
 *     title: 'New Friend Request',
 *     body: 'Alice sent you a friend request',
 *     data: { senderId: '...', senderName: 'Alice' },
 *   });
 */

import { db } from '../db/index';
import { logger } from './logger';
import { notifications } from '../db/schema/notifications';
import { getIO } from './socket-io';
import { evaluateNotificationTrust } from './notificationTrustMatrix';

export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
}

/**
 * Insert a notification row and emit a NOTIFICATION_CREATE socket event
 * to the target user's private room.
 *
 * If the target user is in DND mode or notification quiet hours, the row is still persisted
 * (so they see it later) but the real-time socket event is suppressed.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const { shouldCreate, explanation } = await evaluateNotificationTrust({
      userId: params.userId,
      type: params.type,
      data: params.data ?? null,
    });

    if (!shouldCreate) return;

    const [notif] = await db
      .insert(notifications)
      .values({
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        data: {
          ...(params.data ?? {}),
          notificationTrust: explanation,
        },
      })
      .returning();

    // Emit to the user's private room so they get a real-time notification
    if (!explanation.realtimeSuppressed) {
      try {
        getIO().to(`user:${params.userId}`).emit('NOTIFICATION_CREATE', notif);
      } catch {
        // Socket.io not initialised (test env) — non-fatal
      }
    }
  } catch (err) {
    logger.error('[notifications] failed to create notification:', err);
  }
}
