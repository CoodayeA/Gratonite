import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, or, isNull } from 'drizzle-orm';
import { db } from '../db/index';
import { applicationCommands } from '../db/schema/application-commands';
import { botApplications } from '../db/schema/bot-applications';
import { botInstalls } from '../db/schema/bot-store';
import { channels } from '../db/schema/channels';
import { messages } from '../db/schema/messages';
import { componentInteractions } from '../db/schema/component-interactions';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { dispatchInteraction, dispatchEvent, processActions } from '../lib/webhook-dispatch';
import { logger } from '../lib/logger';

export const commandsRouter = Router({ mergeParams: true });

const createCommandSchema = z.object({
  name: z.string().min(1).max(32),
  description: z.string().min(1).max(100),
  options: z.array(z.record(z.string(), z.unknown())).optional(),
  type: z.number().int().min(1).max(3).optional(),
});

/** GET /guilds/:guildId/commands */
commandsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  const commands = await db.select().from(applicationCommands)
    .where(or(eq(applicationCommands.guildId, guildId), isNull(applicationCommands.guildId)));

  res.json(commands);
});

/** POST /applications/:appId/guilds/:guildId/commands */
commandsRouter.post('/applications/:appId/guilds/:guildId/commands', requireAuth, validate(createCommandSchema), async (req: Request, res: Response): Promise<void> => {
  const { appId, guildId } = req.params as Record<string, string>;
  const { name, description, options, type } = req.body;

  const [command] = await db.insert(applicationCommands).values({
    applicationId: appId,
    guildId,
    name,
    description,
    options: options || [],
    type: type || 1,
  }).onConflictDoNothing().returning();

  if (!command) {
    res.status(409).json({ code: 'CONFLICT', message: 'Command already exists' }); return;
  }

  res.status(201).json(command);
});

/** POST /channels/:channelId/interactions — Execute a slash command interaction */
commandsRouter.post('/channels/:channelId/interactions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const { commandId, options } = req.body as { commandId: string; options?: Record<string, unknown> };

    if (!commandId) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'commandId is required' }); return;
    }

    // Look up the command
    const [command] = await db.select().from(applicationCommands)
      .where(eq(applicationCommands.id, commandId)).limit(1);

    if (!command) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Command not found' }); return;
    }

    // Look up the bot application that owns this command
    const [bot] = await db.select({
      id: botApplications.id,
      webhookUrl: botApplications.webhookUrl,
      webhookSecretKey: botApplications.webhookSecretKey,
      isActive: botApplications.isActive,
      botUserId: botApplications.botUserId,
    }).from(botApplications)
      .where(eq(botApplications.id, command.applicationId))
      .limit(1);

    if (!bot || !bot.isActive) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Bot application not found or inactive' }); return;
    }

    // Resolve channel → guild to verify bot is installed
    const [channel] = await db.select({ guildId: channels.guildId })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel?.guildId) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'Interactions are only supported in guild channels' }); return;
    }

    // Verify bot is installed in this guild
    const [install] = await db.select({ id: botInstalls.id })
      .from(botInstalls)
      .where(and(
        eq(botInstalls.guildId, channel.guildId),
        eq(botInstalls.applicationId, bot.id),
      ))
      .limit(1);

    // Also check via listingId join if applicationId is not directly on botInstalls
    if (!install) {
      const [installViaListing] = await db.select({ id: botInstalls.id })
        .from(botInstalls)
        .innerJoin(botApplications, eq(botInstalls.botId, botApplications.listingId!))
        .where(and(
          eq(botInstalls.guildId, channel.guildId),
          eq(botApplications.id, bot.id),
        ))
        .limit(1);

      if (!installViaListing) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Bot is not installed in this guild' }); return;
      }
    }

    // Dispatch the interaction to the bot's webhook
    const interactionPayload = {
      commandId: command.id,
      commandName: command.name,
      channelId,
      guildId: channel.guildId,
      userId: req.userId!,
      options: options ?? {},
    };

    const response = await dispatchInteraction(bot, interactionPayload, channel.guildId);

    if (response && Array.isArray(response.actions) && response.actions.length > 0) {
      // Actions already processed by dispatchInteraction
      res.json({
        type: 'COMMAND_RESPONSE',
        commandId: command.id,
        commandName: command.name,
        channelId,
        actionsProcessed: response.actions.length,
      });
    } else {
      res.json({
        type: 'COMMAND_RESPONSE',
        commandId: command.id,
        commandName: command.name,
        channelId,
        actionsProcessed: 0,
      });
    }
  } catch (err) {
    logger.error('[commands] interaction error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to process interaction' });
  }
});

/** POST /channels/:channelId/messages/:messageId/components/:customId/interactions — Component interaction */
commandsRouter.post('/channels/:channelId/messages/:messageId/components/:customId/interactions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId, messageId, customId } = req.params as Record<string, string>;
    const { values } = req.body as { values?: string[] };

    // Fetch message to find which bot owns it
    const [msg] = await db.select({ id: messages.id, authorId: messages.authorId, components: messages.components })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.channelId, channelId)))
      .limit(1);

    if (!msg) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Message not found' }); return;
    }

    // Find the bot application by the message's authorId (bot user)
    const [bot] = await db.select({
      id: botApplications.id,
      webhookUrl: botApplications.webhookUrl,
      webhookSecretKey: botApplications.webhookSecretKey,
    }).from(botApplications)
      .where(eq(botApplications.botUserId, msg.authorId!))
      .limit(1);

    if (!bot) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Bot not found for this message' }); return;
    }

    // Resolve guild
    const [channel] = await db.select({ guildId: channels.guildId })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel?.guildId) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'Component interactions only work in guild channels' }); return;
    }

    // Record the interaction
    await db.insert(componentInteractions).values({
      messageId,
      customId: decodeURIComponent(customId),
      userId: req.userId!,
      botApplicationId: bot.id,
      interactionType: values && values.length > 0 ? 'select_menu' : 'button',
      values: values ?? [],
    });

    // Dispatch to bot webhook
    const interactionPayload = {
      customId: decodeURIComponent(customId),
      messageId,
      channelId,
      guildId: channel.guildId,
      userId: req.userId!,
      values: values ?? [],
    };

    // Also dispatch as event
    dispatchEvent(channel.guildId, 'component_interaction', interactionPayload);

    const response = await dispatchInteraction(bot, { ...interactionPayload, interactionType: 'component' }, channel.guildId);

    res.json({
      type: 'COMPONENT_RESPONSE',
      messageId,
      customId: decodeURIComponent(customId),
      actionsProcessed: response?.actions?.length ?? 0,
    });
  } catch (err) {
    logger.error('[commands] component interaction error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to process component interaction' });
  }
});
