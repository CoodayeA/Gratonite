import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, or, isNull } from 'drizzle-orm';
import { db } from '../db/index';
import { applicationCommands } from '../db/schema/application-commands';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

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

/** POST /channels/:channelId/interactions */
commandsRouter.post('/channels/:channelId/interactions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;
  const { commandId, options } = req.body as { commandId: string; options?: Record<string, unknown> };

  if (!commandId) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'commandId is required' }); return;
  }

  const [command] = await db.select().from(applicationCommands)
    .where(eq(applicationCommands.id, commandId)).limit(1);

  if (!command) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Command not found' }); return;
  }

  // In a full implementation, this would forward to the bot's webhook URL
  res.json({ type: 'COMMAND_RESPONSE', commandId, channelId, options });
});
