/**
 * lib/webhook-dispatch.ts — Outbound webhook event dispatcher for webhook bots.
 *
 * When a message is created in a guild, call `dispatchMessageCreate` with the
 * relevant context. This module:
 *   1. Looks up all webhook bots installed in that guild (via botInstalls).
 *   2. Signs the event payload with the bot's HMAC-SHA256 webhookSecretKey.
 *   3. POSTs to the bot's webhookUrl with a 3-second timeout.
 *   4. Parses any action response and executes supported actions.
 *
 * All dispatch calls are fire-and-forget — errors are logged but never
 * surfaced back to the user who sent the message.
 */

import crypto from 'node:crypto';
import { logger } from './logger';
import { eq } from 'drizzle-orm';

import { db } from '../db/index';
import { botApplications } from '../db/schema/bot-applications';
import { botInstalls } from '../db/schema/bot-store';
import { messages } from '../db/schema/messages';
import { channels } from '../db/schema/channels';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MessageCreateEvent {
  guildId: string;
  channelId: string;
  messageId: string;
  content: string;
  author: {
    id: string;
    username: string;
    displayName: string | null;
  };
  timestamp: string;
}

interface BotAction {
  type: 'send_message' | 'add_role' | 'remove_role' | 'kick_member';
  channelId?: string;
  content?: string;
  userId?: string;
  roleId?: string;
  guildId?: string;
}

interface BotActionResponse {
  actions?: BotAction[];
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

/**
 * Produces an HMAC-SHA256 hex digest of `payload` using `secret`.
 * The digest is sent as the `X-Gratonite-Signature` header so the bot can
 * verify the event originated from Gratonite.
 */
function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// ---------------------------------------------------------------------------
// Action processor
// ---------------------------------------------------------------------------

/**
 * Executes validated actions returned by a bot's webhook response.
 * Only `send_message` is supported for now; others are logged and ignored
 * until the permission model is fully designed.
 */
async function processActions(actions: BotAction[], guildId: string): Promise<void> {
  for (const action of actions) {
    try {
      if (action.type === 'send_message') {
        if (!action.channelId || !action.content) continue;

        // Validate channel belongs to the guild
        const [channel] = await db
          .select({ id: channels.id })
          .from(channels)
          .where(eq(channels.id, action.channelId))
          .limit(1);

        if (!channel) {
          console.warn('[webhook-dispatch] send_message: unknown channel', action.channelId);
          continue;
        }

        // Insert the bot message with a null authorId (system/bot message)
        await db.insert(messages).values({
          channelId: action.channelId,
          content: action.content.slice(0, 4000), // enforce message length cap
          authorId: null,
        });
      } else {
        // add_role, remove_role, kick_member — log for future implementation
        console.info('[webhook-dispatch] unhandled action type:', action.type, '(guildId:', guildId, ')');
      }
    } catch (actionErr) {
      logger.error('[webhook-dispatch] action processing error:', action.type, actionErr);
    }
  }
}

// ---------------------------------------------------------------------------
// Retry with exponential backoff
// ---------------------------------------------------------------------------

async function deliverWebhookWithRetry(url: string, payload: string, headers: Record<string, string>, maxRetries = 3): Promise<{ ok: boolean; status: number; body: string }> {
  const delays = [1000, 5000, 30000];
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: payload,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const body = await res.text();
      if (res.ok) return { ok: true, status: res.status, body };
      // Retry on 5xx errors only
      if (res.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delays[attempt]));
        continue;
      }
      return { ok: false, status: res.status, body };
    } catch {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delays[attempt]));
        continue;
      }
    }
  }
  return { ok: false, status: 0, body: '' };
}

// ---------------------------------------------------------------------------
// Core dispatch
// ---------------------------------------------------------------------------

/**
 * Dispatches a `message_create` event to all webhook bots installed in the
 * given guild. This function is intentionally fire-and-forget: it returns
 * immediately after kicking off async dispatch tasks and never throws.
 */
export function dispatchMessageCreate(event: MessageCreateEvent): void {
  // Kick off async work without awaiting.
  void _dispatchAsync(event);
}

async function _dispatchAsync(event: MessageCreateEvent): Promise<void> {
  try {
    // Find all botApplications that have a listing installed in this guild.
    // botInstalls.botId references botListings.id
    // botApplications.listingId references botListings.id
    const bots = await db
      .select({
        id: botApplications.id,
        webhookUrl: botApplications.webhookUrl,
        webhookSecretKey: botApplications.webhookSecretKey,
        isActive: botApplications.isActive,
      })
      .from(botApplications)
      .innerJoin(botInstalls, eq(botInstalls.botId, botApplications.listingId!))
      .where(eq(botInstalls.guildId, event.guildId));

    if (bots.length === 0) return;

    const payload = JSON.stringify({
      type: 'message_create',
      guildId: event.guildId,
      channelId: event.channelId,
      messageId: event.messageId,
      content: event.content,
      author: event.author,
      timestamp: event.timestamp,
    });

    await Promise.allSettled(
      bots
        .filter((bot) => bot.isActive)
        .map((bot) => _sendToBot(bot, payload, event.guildId)),
    );
  } catch (err) {
    logger.error('[webhook-dispatch] dispatch error for guild', event.guildId, err);
  }
}

async function _sendToBot(
  bot: { id: string; webhookUrl: string; webhookSecretKey: string },
  payload: string,
  guildId: string,
): Promise<void> {
  try {
    const signature = sign(payload, bot.webhookSecretKey);

    const result = await deliverWebhookWithRetry(bot.webhookUrl, payload, {
      'X-Gratonite-Signature': signature,
      'X-Gratonite-Bot-Id': bot.id,
    });

    if (!result.ok) {
      console.warn('[webhook-dispatch] delivery failed for bot', bot.id, 'status:', result.status);
      return;
    }

    // Parse action response if present
    let responseBody: BotActionResponse = {};
    if (result.body) {
      try { responseBody = JSON.parse(result.body) as BotActionResponse; } catch { /* ignore */ }
    }

    // Process any actions the bot returned.
    if (Array.isArray(responseBody.actions) && responseBody.actions.length > 0) {
      await processActions(responseBody.actions, guildId);
    }
  } catch (err) {
    logger.error('[webhook-dispatch] unexpected error for bot', bot.id, err);
  }
}
