/** federation/activities.ts — Inbound/outbound federation activity dispatch. */

import crypto from 'node:crypto';
import { db } from '../db/index';
import { federationActivities } from '../db/schema/federation-activities';
import { federatedInstances } from '../db/schema/federation-instances';
import { eq } from 'drizzle-orm';
import { signRequest } from '../lib/http-signature';
import { getActiveKeyPair } from './crypto';
import { isFederationEnabled, getFederationFlags, getInstanceDomain } from './index';
import { getRelayClient, isRelayEnabled } from '../relay/index';
import { getDeliveryMethod, markReachable, markUnreachable } from '../relay/router';
import { createEnvelope } from '../relay/envelope';

/** Activity types for the federation protocol. */
export type ActivityType =
  | 'InstanceHello'
  | 'InstanceHelloAck'
  | 'GuildJoinRequest'
  | 'GuildJoinApproved'
  | 'GuildJoinDenied'
  | 'GuildLeave'
  | 'MessageCreate'
  | 'MessageUpdate'
  | 'MessageDelete'
  | 'TypingStart'
  | 'PresenceUpdate'
  | 'UserProfileSync'
  | 'GuildMetadataSync'
  | 'ReplicaAck'
  | 'AccountTransfer';

/** Queue an outbound activity for delivery to a remote instance. */
export async function queueOutboundActivity(
  instanceId: string,
  activityType: ActivityType,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!isFederationEnabled()) return;
  const flags = getFederationFlags();
  if (!flags.allowOutbound) return;

  const idempotencyKey = `${activityType}:${instanceId}:${crypto.randomUUID()}`;

  await db.insert(federationActivities).values({
    direction: 'outbound',
    activityType,
    instanceId,
    payload,
    status: 'pending',
    idempotencyKey,
    nextAttemptAt: new Date(),
  });
}

/** Record an inbound activity for audit/tracking. */
export async function recordInboundActivity(
  instanceId: string | null,
  activityType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const idempotencyKey = `inbound:${activityType}:${crypto.randomUUID()}`;

  await db.insert(federationActivities).values({
    direction: 'inbound',
    activityType,
    instanceId,
    payload,
    status: 'delivered',
    idempotencyKey,
  });
}

/** Deliver a single outbound activity via HTTP POST to the remote instance's inbox. */
export async function deliverActivity(activityId: string): Promise<void> {
  const [activity] = await db
    .select()
    .from(federationActivities)
    .where(eq(federationActivities.id, activityId))
    .limit(1);

  if (!activity || activity.direction !== 'outbound') return;
  if (!activity.instanceId) {
    await db.update(federationActivities)
      .set({ status: 'dead', error: 'No target instance', updatedAt: new Date() })
      .where(eq(federationActivities.id, activityId));
    return;
  }

  await db.update(federationActivities)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(federationActivities.id, activityId));

  const [instance] = await db
    .select()
    .from(federatedInstances)
    .where(eq(federatedInstances.id, activity.instanceId))
    .limit(1);

  if (!instance || instance.status !== 'active') {
    await db.update(federationActivities)
      .set({ status: 'dead', error: 'Target instance not active', updatedAt: new Date() })
      .where(eq(federationActivities.id, activityId));
    return;
  }

  const kp = getActiveKeyPair();
  const domain = getInstanceDomain();

  // Determine delivery method: direct HTTP or relay
  const targetDomain = new URL(instance.baseUrl).hostname;
  const relayClient = getRelayClient();
  const relayConnected = relayClient?.isConnected() ?? false;
  const method = await getDeliveryMethod(targetDomain, relayConnected);

  const body = JSON.stringify({
    type: activity.activityType,
    origin: `https://${domain}`,
    timestamp: new Date().toISOString(),
    payload: activity.payload,
  });

  try {
    if (method === 'relay' && relayClient && instance.publicKeyPem) {
      // Deliver via relay with E2E encryption
      const envelope = createEnvelope(
        targetDomain,
        domain,
        { type: activity.activityType, data: activity.payload as Record<string, unknown> },
        kp.privateKeyPem,
        instance.publicKeyPem,
      );

      const sent = relayClient.send(envelope);
      if (!sent) {
        throw new Error('Relay client not connected');
      }

      await db.update(federationActivities)
        .set({ status: 'delivered', updatedAt: new Date() })
        .where(eq(federationActivities.id, activityId));
    } else {
      // Direct HTTP delivery
      const inboxUrl = `${instance.baseUrl}/api/v1/federation/inbox`;
      const headers = signRequest('POST', inboxUrl, body, kp.keyId, kp.privateKeyPem);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      const resp = await fetch(inboxUrl, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (resp.ok) {
        await markReachable(targetDomain);
        await db.update(federationActivities)
          .set({ status: 'delivered', updatedAt: new Date() })
          .where(eq(federationActivities.id, activityId));
      } else {
        await markUnreachable(targetDomain);
        const errorText = await resp.text().catch(() => 'unknown');
        throw new Error(`HTTP ${resp.status}: ${errorText.slice(0, 500)}`);
      }
    }
  } catch (err) {
    const attempts = activity.attempts + 1;
    const errorMsg = err instanceof Error ? err.message : String(err);

    if (attempts >= activity.maxAttempts) {
      await db.update(federationActivities)
        .set({ status: 'dead', attempts, error: errorMsg, updatedAt: new Date() })
        .where(eq(federationActivities.id, activityId));
    } else {
      // Exponential backoff: 1min, 5min, 30min, 2hr, 12hr
      const backoffMs = [60, 300, 1800, 7200, 43200][Math.min(attempts - 1, 4)] * 1000;
      const nextAttempt = new Date(Date.now() + backoffMs);

      await db.update(federationActivities)
        .set({ status: 'pending', attempts, error: errorMsg, nextAttemptAt: nextAttempt, updatedAt: new Date() })
        .where(eq(federationActivities.id, activityId));
    }
  }
}
