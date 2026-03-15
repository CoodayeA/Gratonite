/**
 * jobs/worker.ts — Central BullMQ worker registration.
 *
 * Registers repeatable jobs and their processors for all migrated cron jobs.
 * Non-migrated jobs continue to use setInterval (started from index.ts).
 *
 * Usage: call `startBullWorkers()` from index.ts after the server is listening.
 */

import { createQueue, createWorker } from '../lib/queue';
import { logger } from '../lib/logger';

// ---------------------------------------------------------------------------
// Job processors (inline — the logic is extracted from the original files)
// ---------------------------------------------------------------------------

import { processScheduledMessages } from './scheduledMessages';
import { processMessageExpiry } from '../lib/message-expiry';
import { processEmailNotifications } from './emailNotifications';
import { processFederationDelivery } from './federationDelivery';

// ---------------------------------------------------------------------------
// Queue definitions
// ---------------------------------------------------------------------------

export const scheduledMessagesQueue = createQueue('scheduled-messages');
export const messageExpiryQueue = createQueue('message-expiry');
export const emailNotificationsQueue = createQueue('email-notifications');
export const federationDeliveryQueue = createQueue('federation-delivery');

// ---------------------------------------------------------------------------
// Start workers and add repeatable schedules
// ---------------------------------------------------------------------------

export async function startBullWorkers(): Promise<void> {
  // --- Scheduled Messages (every 30s) ---
  createWorker('scheduled-messages', async () => {
    await processScheduledMessages();
  });
  await scheduledMessagesQueue.upsertJobScheduler(
    'scheduled-messages-repeat',
    { every: 30_000 },
    { name: 'scheduled-messages-tick' },
  );

  // --- Message Expiry (every 60s) ---
  createWorker('message-expiry', async () => {
    await processMessageExpiry();
  });
  await messageExpiryQueue.upsertJobScheduler(
    'message-expiry-repeat',
    { every: 60_000 },
    { name: 'message-expiry-tick' },
  );

  // --- Email Notifications (every 15 min) ---
  createWorker('email-notifications', async () => {
    await processEmailNotifications();
  });
  await emailNotificationsQueue.upsertJobScheduler(
    'email-notifications-repeat',
    { every: 15 * 60_000 },
    { name: 'email-notifications-tick' },
  );

  // --- Federation Delivery (every 10s) ---
  createWorker('federation-delivery', async () => {
    await processFederationDelivery();
  });
  await federationDeliveryQueue.upsertJobScheduler(
    'federation-delivery-repeat',
    { every: 10_000 },
    { name: 'federation-delivery-tick' },
  );

  logger.info('[bullmq] All workers started and repeatable jobs registered');
}
