/**
 * lib/webhook-dispatch.ts — Outbound webhook event dispatcher for webhook bots.
 *
 * Dispatches events to all webhook bots installed in a guild. Supports:
 *   - message_create, message_update, message_delete
 *   - member_join, member_leave
 *   - reaction_add, reaction_remove
 *
 * Bot action responses: send_message (with embeds), add_role, remove_role, kick_member.
 *
 * All dispatch calls are fire-and-forget — errors are logged but never
 * surfaced back to the caller.
 */

import { logger } from './logger';
import { eq, and, sql } from 'drizzle-orm';
import { signPayload, deliverWebhookWithRetry } from './webhook-signing';

import { db } from '../db/index';
import { botApplications } from '../db/schema/bot-applications';
import { botInstalls } from '../db/schema/bot-store';
import { messages } from '../db/schema/messages';
import { channels } from '../db/schema/channels';
import { memberRoles, roles } from '../db/schema/roles';
import { guildMembers, guilds } from '../db/schema/guilds';
import { getIO } from './socket-io';

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

/** Rich embed object that bots can include in send_message actions. */
export interface BotEmbed {
  title?: string;
  description?: string;
  color?: string;
  url?: string;
  thumbnail?: string;
  footer?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

interface BotAction {
  type: 'send_message' | 'add_role' | 'remove_role' | 'kick_member';
  channelId?: string;
  content?: string;
  embeds?: BotEmbed[];
  userId?: string;
  roleId?: string;
  guildId?: string;
}

interface BotActionResponse {
  actions?: BotAction[];
}

// ---------------------------------------------------------------------------
// Action processor
// ---------------------------------------------------------------------------

/**
 * Executes validated actions returned by a bot's webhook response.
 * Supports: send_message (with embeds), add_role, remove_role, kick_member.
 */
export async function processActions(actions: BotAction[], guildId: string, botAuthorId?: string | null): Promise<void> {
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'send_message': {
          if (!action.channelId || (!action.content && (!action.embeds || action.embeds.length === 0))) continue;

          // Validate channel exists AND belongs to the guild (prevent cross-guild injection)
          const [channel] = await db
            .select({ id: channels.id, guildId: channels.guildId })
            .from(channels)
            .where(and(eq(channels.id, action.channelId), eq(channels.guildId, guildId)))
            .limit(1);

          if (!channel) {
            logger.warn('[webhook-dispatch] send_message: channel not found or not in guild', action.channelId, guildId);
            continue;
          }

          // Validate and cap embeds
          let embedsJson: BotEmbed[] = [];
          if (Array.isArray(action.embeds)) {
            embedsJson = action.embeds.slice(0, 10).map(e => ({
              type: 'rich' as const,
              title: typeof e.title === 'string' ? e.title.slice(0, 256) : undefined,
              description: typeof e.description === 'string' ? e.description.slice(0, 4096) : undefined,
              color: typeof e.color === 'string' ? e.color : undefined,
              url: typeof e.url === 'string' ? e.url : undefined,
              thumbnail: typeof e.thumbnail === 'string' ? e.thumbnail : undefined,
              footer: typeof e.footer === 'string' ? e.footer : undefined,
              fields: Array.isArray(e.fields)
                ? e.fields.slice(0, 25).map(f => ({
                    name: String(f.name || '').slice(0, 256),
                    value: String(f.value || '').slice(0, 1024),
                    inline: !!f.inline,
                  }))
                : undefined,
            }));
          }

          const [newMsg] = await db.insert(messages).values({
            channelId: action.channelId,
            content: action.content ? action.content.slice(0, 4000) : null,
            authorId: botAuthorId ?? null,
            embeds: embedsJson.length > 0 ? embedsJson : [],
          }).returning();

          // Emit socket event so message appears in real time
          try {
            getIO().to(`channel:${action.channelId}`).emit('MESSAGE_CREATE', {
              id: newMsg.id,
              channelId: action.channelId,
              content: newMsg.content,
              authorId: newMsg.authorId,
              embeds: embedsJson,
              attachments: [],
              createdAt: newMsg.createdAt,
              author: null, // bot user will be resolved by client
            });
          } catch { /* socket not available */ }
          break;
        }

        case 'add_role': {
          if (!action.userId || !action.roleId) continue;

          // Verify role exists and belongs to the guild
          const [role] = await db
            .select({ id: roles.id })
            .from(roles)
            .where(and(eq(roles.id, action.roleId), eq(roles.guildId, guildId)))
            .limit(1);
          if (!role) {
            logger.warn('[webhook-dispatch] add_role: unknown role', action.roleId);
            continue;
          }

          // Verify member exists in guild
          const [member] = await db
            .select({ id: guildMembers.id })
            .from(guildMembers)
            .where(and(eq(guildMembers.userId, action.userId), eq(guildMembers.guildId, guildId)))
            .limit(1);
          if (!member) {
            logger.warn('[webhook-dispatch] add_role: user not in guild', action.userId);
            continue;
          }

          await db.insert(memberRoles).values({
            userId: action.userId,
            roleId: action.roleId,
            guildId,
          }).onConflictDoNothing();

          try {
            getIO().to(`guild:${guildId}`).emit('GUILD_MEMBER_ROLE_ADD', {
              guildId, userId: action.userId, roleId: action.roleId,
            });
          } catch { /* non-fatal */ }
          break;
        }

        case 'remove_role': {
          if (!action.userId || !action.roleId) continue;

          await db.delete(memberRoles).where(
            and(
              eq(memberRoles.userId, action.userId),
              eq(memberRoles.roleId, action.roleId),
              eq(memberRoles.guildId, guildId),
            ),
          );

          try {
            getIO().to(`guild:${guildId}`).emit('GUILD_MEMBER_ROLE_REMOVE', {
              guildId, userId: action.userId, roleId: action.roleId,
            });
          } catch { /* non-fatal */ }
          break;
        }

        case 'kick_member': {
          if (!action.userId) continue;

          // Prevent kicking the guild owner
          const [guild] = await db.select({ ownerId: guilds.ownerId }).from(guilds)
            .where(eq(guilds.id, guildId)).limit(1);
          if (guild && guild.ownerId === action.userId) {
            logger.warn('[webhook-dispatch] kick_member: cannot kick guild owner', action.userId);
            continue;
          }

          // Delete guild membership
          const deleted = await db.delete(guildMembers).where(
            and(
              eq(guildMembers.userId, action.userId),
              eq(guildMembers.guildId, guildId),
            ),
          ).returning();

          if (deleted.length === 0) {
            logger.warn('[webhook-dispatch] kick_member: user not in guild', action.userId);
            continue;
          }

          // Decrement member count
          await db
            .update(guilds)
            .set({ memberCount: sql`GREATEST(${guilds.memberCount} - 1, 0)`, updatedAt: new Date() })
            .where(eq(guilds.id, guildId));

          try {
            const io = getIO();
            io.to(`guild:${guildId}`).emit('GUILD_MEMBER_REMOVE', { guildId, userId: action.userId });
            io.to(`user:${action.userId}`).emit('GUILD_LEFT', { guildId });
          } catch { /* non-fatal */ }
          break;
        }
      }
    } catch (actionErr) {
      logger.error('[webhook-dispatch] action processing error:', action.type, actionErr);
    }
  }
}

// ---------------------------------------------------------------------------
// Bot lookup helper
// ---------------------------------------------------------------------------

interface BotRow {
  id: string;
  webhookUrl: string;
  webhookSecretKey: string;
  subscribedEvents: string[] | null;
  botUserId: string | null;
}

async function getInstalledBots(guildId: string): Promise<BotRow[]> {
  const bots = await db
    .select({
      id: botApplications.id,
      webhookUrl: botApplications.webhookUrl,
      webhookSecretKey: botApplications.webhookSecretKey,
      isActive: botApplications.isActive,
      subscribedEvents: botApplications.subscribedEvents,
      botUserId: botApplications.botUserId,
    })
    .from(botApplications)
    .innerJoin(botInstalls, eq(botInstalls.botId, botApplications.listingId!))
    .where(eq(botInstalls.guildId, guildId));

  return bots.filter(b => b.isActive) as BotRow[];
}

// ---------------------------------------------------------------------------
// Send to bot with action processing
// ---------------------------------------------------------------------------

async function _sendToBot(
  bot: BotRow,
  payload: string,
  guildId: string,
): Promise<BotActionResponse | null> {
  try {
    const signature = signPayload(payload, bot.webhookSecretKey);

    const result = await deliverWebhookWithRetry(bot.webhookUrl, payload, {
      'X-Gratonite-Signature': signature,
      'X-Gratonite-Bot-Id': bot.id,
    });

    if (!result.ok) {
      logger.warn('[webhook-dispatch] delivery failed for bot', bot.id, 'status:', result.status);
      return null;
    }

    let responseBody: BotActionResponse = {};
    if (result.body) {
      try { responseBody = JSON.parse(result.body) as BotActionResponse; } catch { /* ignore */ }
    }

    if (Array.isArray(responseBody.actions) && responseBody.actions.length > 0) {
      await processActions(responseBody.actions, guildId, bot.botUserId);
    }

    return responseBody;
  } catch (err) {
    logger.error('[webhook-dispatch] unexpected error for bot', bot.id, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Generic event dispatch
// ---------------------------------------------------------------------------

/**
 * Dispatches any event type to all webhook bots installed in the guild.
 * Bots are filtered by their `subscribedEvents` column (if set).
 * Fire-and-forget — never throws.
 */
export function dispatchEvent(guildId: string, eventType: string, eventPayload: Record<string, unknown>): void {
  void _dispatchEventAsync(guildId, eventType, eventPayload);
}

async function _dispatchEventAsync(guildId: string, eventType: string, eventPayload: Record<string, unknown>): Promise<void> {
  try {
    const bots = await getInstalledBots(guildId);
    if (bots.length === 0) return;

    // Filter bots by subscribed events
    const eligible = bots.filter(bot => {
      if (!bot.subscribedEvents || !Array.isArray(bot.subscribedEvents)) return true;
      return bot.subscribedEvents.includes(eventType);
    });

    if (eligible.length === 0) return;

    const payload = JSON.stringify({ type: eventType, guildId, ...eventPayload });

    await Promise.allSettled(
      eligible.map(bot => _sendToBot(bot, payload, guildId)),
    );
  } catch (err) {
    logger.error('[webhook-dispatch] dispatch error for guild', guildId, err);
  }
}

// ---------------------------------------------------------------------------
// Convenience: message_create dispatch (backward-compatible)
// ---------------------------------------------------------------------------

/**
 * Dispatches a `message_create` event to all webhook bots installed in the
 * given guild. Fire-and-forget.
 */
export function dispatchMessageCreate(event: MessageCreateEvent): void {
  dispatchEvent(event.guildId, 'message_create', {
    channelId: event.channelId,
    messageId: event.messageId,
    content: event.content,
    author: event.author,
    timestamp: event.timestamp,
  });
}

// ---------------------------------------------------------------------------
// Interaction dispatch (for slash commands)
// ---------------------------------------------------------------------------

/**
 * Dispatches an interaction (slash command) to a specific bot and returns
 * the bot's action response. This is NOT fire-and-forget — the caller
 * awaits the response to render the bot's reply.
 */
export async function dispatchInteraction(
  bot: { id: string; webhookUrl: string; webhookSecretKey: string; botUserId?: string | null },
  interactionPayload: Record<string, unknown>,
  guildId: string,
): Promise<BotActionResponse | null> {
  const payload = JSON.stringify({ type: 'interaction', ...interactionPayload });
  return _sendToBot({ ...bot, subscribedEvents: null, botUserId: bot.botUserId ?? null } as BotRow, payload, guildId);
}
