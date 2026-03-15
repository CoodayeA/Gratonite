/**
 * jobs/worker.ts — Central BullMQ worker registration.
 *
 * Registers repeatable jobs and their processors for all cron jobs.
 * Legacy setInterval starters are kept in each file with @deprecated tags
 * and are only used as fallback if BullMQ fails to start.
 *
 * Usage: call `startBullWorkers()` from index.ts after the server is listening.
 */

import { createQueue, createWorker } from '../lib/queue';
import { logger } from '../lib/logger';

// ---------------------------------------------------------------------------
// Job processors
// ---------------------------------------------------------------------------

import { processScheduledMessages } from './scheduledMessages';
import { processMessageExpiry } from '../lib/message-expiry';
import { processEmailNotifications } from './emailNotifications';
import { processFederationDelivery } from './federationDelivery';
import { processAccountDeletion } from './accountDeletion';
import { processAfkMover } from './afkMover';
import { processAutoArchiveChannels } from './autoArchiveChannels';
import { processAutoRoles } from './autoRoles';
import { processExpireStatuses } from './expireStatuses';
import { processFederationCleanup } from './federationCleanup';
import { processFederationDiscoverSync } from './federationDiscoverSync';
import { processFederationHeartbeat } from './federationHeartbeat';
import { processFriendshipStreaks } from './friendshipStreaks';
import { processGiveaways } from './giveaways';
import { processGuildDigest } from './guildDigest';
import { processReminders } from './reminders';
import { processReplicaSync } from './replicaSync';
import { processUnbanExpired } from './unbanExpired';
import { processUpdateCheck } from './updateCheck';
import { processAuctionCron } from '../lib/auction-cron';
import { processRelayDirectorySync } from './relayDirectorySync';
import { processRelayHealthCheck } from './relayHealthCheck';
import { processRelayReputationCalc } from './relayReputationCalc';

// ---------------------------------------------------------------------------
// Queue definitions
// ---------------------------------------------------------------------------

export const scheduledMessagesQueue = createQueue('scheduled-messages');
export const messageExpiryQueue = createQueue('message-expiry');
export const emailNotificationsQueue = createQueue('email-notifications');
export const federationDeliveryQueue = createQueue('federation-delivery');
export const accountDeletionQueue = createQueue('account-deletion');
export const afkMoverQueue = createQueue('afk-mover');
export const autoArchiveChannelsQueue = createQueue('auto-archive-channels');
export const autoRolesQueue = createQueue('auto-roles');
export const expireStatusesQueue = createQueue('expire-statuses');
export const federationCleanupQueue = createQueue('federation-cleanup');
export const federationDiscoverSyncQueue = createQueue('federation-discover-sync');
export const federationHeartbeatQueue = createQueue('federation-heartbeat');
export const friendshipStreaksQueue = createQueue('friendship-streaks');
export const giveawaysQueue = createQueue('giveaways');
export const guildDigestQueue = createQueue('guild-digest');
export const remindersQueue = createQueue('reminders');
export const replicaSyncQueue = createQueue('replica-sync');
export const unbanExpiredQueue = createQueue('unban-expired');
export const updateCheckQueue = createQueue('update-check');
export const auctionCronQueue = createQueue('auction-cron');
export const relayDirectorySyncQueue = createQueue('relay-directory-sync');
export const relayHealthCheckQueue = createQueue('relay-health-check');
export const relayReputationCalcQueue = createQueue('relay-reputation-calc');

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

  // --- Account Deletion (every 24h) ---
  createWorker('account-deletion', async () => {
    await processAccountDeletion();
  });
  await accountDeletionQueue.upsertJobScheduler(
    'account-deletion-repeat',
    { every: 24 * 60 * 60_000 },
    { name: 'account-deletion-tick' },
  );

  // --- AFK Mover (every 30s) ---
  createWorker('afk-mover', async () => {
    await processAfkMover();
  });
  await afkMoverQueue.upsertJobScheduler(
    'afk-mover-repeat',
    { every: 30_000 },
    { name: 'afk-mover-tick' },
  );

  // --- Auto Archive Channels (every 1h) ---
  createWorker('auto-archive-channels', async () => {
    await processAutoArchiveChannels();
  });
  await autoArchiveChannelsQueue.upsertJobScheduler(
    'auto-archive-channels-repeat',
    { every: 60 * 60_000 },
    { name: 'auto-archive-channels-tick' },
  );

  // --- Auto Roles (every 5 min) ---
  createWorker('auto-roles', async () => {
    await processAutoRoles();
  });
  await autoRolesQueue.upsertJobScheduler(
    'auto-roles-repeat',
    { every: 5 * 60_000 },
    { name: 'auto-roles-tick' },
  );

  // --- Expire Statuses (every 5 min) ---
  createWorker('expire-statuses', async () => {
    await processExpireStatuses();
  });
  await expireStatusesQueue.upsertJobScheduler(
    'expire-statuses-repeat',
    { every: 5 * 60_000 },
    { name: 'expire-statuses-tick' },
  );

  // --- Federation Cleanup (every 24h) ---
  createWorker('federation-cleanup', async () => {
    await processFederationCleanup();
  });
  await federationCleanupQueue.upsertJobScheduler(
    'federation-cleanup-repeat',
    { every: 24 * 60 * 60_000 },
    { name: 'federation-cleanup-tick' },
  );

  // --- Federation Discover Sync (every 30 min) ---
  createWorker('federation-discover-sync', async () => {
    await processFederationDiscoverSync();
  });
  await federationDiscoverSyncQueue.upsertJobScheduler(
    'federation-discover-sync-repeat',
    { every: 30 * 60_000 },
    { name: 'federation-discover-sync-tick' },
  );

  // --- Federation Heartbeat (every 5 min) ---
  createWorker('federation-heartbeat', async () => {
    await processFederationHeartbeat();
  });
  await federationHeartbeatQueue.upsertJobScheduler(
    'federation-heartbeat-repeat',
    { every: 5 * 60_000 },
    { name: 'federation-heartbeat-tick' },
  );

  // --- Friendship Streaks (every 24h) ---
  createWorker('friendship-streaks', async () => {
    await processFriendshipStreaks();
  });
  await friendshipStreaksQueue.upsertJobScheduler(
    'friendship-streaks-repeat',
    { every: 24 * 60 * 60_000 },
    { name: 'friendship-streaks-tick' },
  );

  // --- Giveaways (every 30s) ---
  createWorker('giveaways', async () => {
    await processGiveaways();
  });
  await giveawaysQueue.upsertJobScheduler(
    'giveaways-repeat',
    { every: 30_000 },
    { name: 'giveaways-tick' },
  );

  // --- Guild Digest (every 1h) ---
  createWorker('guild-digest', async () => {
    await processGuildDigest();
  });
  await guildDigestQueue.upsertJobScheduler(
    'guild-digest-repeat',
    { every: 60 * 60_000 },
    { name: 'guild-digest-tick' },
  );

  // --- Reminders (every 30s) ---
  createWorker('reminders', async () => {
    await processReminders();
  });
  await remindersQueue.upsertJobScheduler(
    'reminders-repeat',
    { every: 30_000 },
    { name: 'reminders-tick' },
  );

  // --- Replica Sync (every 30s) ---
  createWorker('replica-sync', async () => {
    await processReplicaSync();
  });
  await replicaSyncQueue.upsertJobScheduler(
    'replica-sync-repeat',
    { every: 30_000 },
    { name: 'replica-sync-tick' },
  );

  // --- Unban Expired (every 60s) ---
  createWorker('unban-expired', async () => {
    await processUnbanExpired();
  });
  await unbanExpiredQueue.upsertJobScheduler(
    'unban-expired-repeat',
    { every: 60_000 },
    { name: 'unban-expired-tick' },
  );

  // --- Update Check (every 6h) ---
  createWorker('update-check', async () => {
    await processUpdateCheck();
  });
  await updateCheckQueue.upsertJobScheduler(
    'update-check-repeat',
    { every: 6 * 60 * 60_000 },
    { name: 'update-check-tick' },
  );

  // --- Auction Cron (every 60s) ---
  createWorker('auction-cron', async () => {
    await processAuctionCron();
  });
  await auctionCronQueue.upsertJobScheduler(
    'auction-cron-repeat',
    { every: 60_000 },
    { name: 'auction-cron-tick' },
  );

  // --- Relay Directory Sync (every 30 min) ---
  createWorker('relay-directory-sync', async () => {
    await processRelayDirectorySync();
  });
  await relayDirectorySyncQueue.upsertJobScheduler(
    'relay-directory-sync-repeat',
    { every: 30 * 60_000 },
    { name: 'relay-directory-sync-tick' },
  );

  // --- Relay Health Check (every 60s) ---
  createWorker('relay-health-check', async () => {
    await processRelayHealthCheck();
  });
  await relayHealthCheckQueue.upsertJobScheduler(
    'relay-health-check-repeat',
    { every: 60_000 },
    { name: 'relay-health-check-tick' },
  );

  // --- Relay Reputation Calc (every 5 min) ---
  createWorker('relay-reputation-calc', async () => {
    await processRelayReputationCalc();
  });
  await relayReputationCalcQueue.upsertJobScheduler(
    'relay-reputation-calc-repeat',
    { every: 5 * 60_000 },
    { name: 'relay-reputation-calc-tick' },
  );

  logger.info('[bullmq] All workers started and repeatable jobs registered');
}
