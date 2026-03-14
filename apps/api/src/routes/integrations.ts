/**
 * routes/integrations.ts — Integration marketplace (GitHub, Jira, RSS, custom webhooks).
 * Mounted at /guilds/:guildId/integrations
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { integrations, integrationLogs } from '../db/schema/integrations';
import { guilds } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';
import { Permissions } from '../db/schema/roles';

export const integrationsRouter = Router({ mergeParams: true });

// Available integration types
const INTEGRATION_CATALOG = [
  { type: 'github', name: 'GitHub', description: 'Get push, PR, and issue notifications', icon: 'github', configFields: ['repo', 'events'] },
  { type: 'jira', name: 'Jira', description: 'Track Jira issues and updates', icon: 'clipboard', configFields: ['project', 'webhookUrl'] },
  { type: 'rss', name: 'RSS Feed', description: 'Subscribe to any RSS/Atom feed', icon: 'rss', configFields: ['feedUrl', 'pollInterval'] },
  { type: 'custom_webhook', name: 'Custom Webhook', description: 'Receive data from any external service', icon: 'globe', configFields: ['secret'] },
];

// GET /guilds/:guildId/integrations/catalog — list available integrations
integrationsRouter.get('/catalog', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  res.json(INTEGRATION_CATALOG);
});

// GET /guilds/:guildId/integrations — list installed integrations
integrationsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const rows = await db.select().from(integrations)
    .where(eq(integrations.guildId, guildId))
    .orderBy(desc(integrations.createdAt));
  res.json(rows);
});

// POST /guilds/:guildId/integrations — install integration
integrationsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN' }); return;
  }

  const { type, name, channelId, config } = req.body;
  if (!type || !channelId) { res.status(400).json({ code: 'BAD_REQUEST', message: 'type and channelId required' }); return; }

  const [row] = await db.insert(integrations).values({
    guildId,
    channelId,
    type,
    name: name || type,
    config: config || {},
    createdBy: req.userId!,
  }).returning();

  res.status(201).json(row);
});

// PATCH /guilds/:guildId/integrations/:id — update
integrationsRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, id } = req.params as Record<string, string>;
  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN' }); return;
  }

  const { name, config, enabled, channelId } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (config !== undefined) updates.config = config;
  if (enabled !== undefined) updates.enabled = enabled;
  if (channelId !== undefined) updates.channelId = channelId;

  const [updated] = await db.update(integrations).set(updates)
    .where(and(eq(integrations.id, id), eq(integrations.guildId, guildId))).returning();
  if (!updated) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  res.json(updated);
});

// DELETE /guilds/:guildId/integrations/:id
integrationsRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, id } = req.params as Record<string, string>;
  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN' }); return;
  }

  await db.delete(integrations).where(and(eq(integrations.id, id), eq(integrations.guildId, guildId)));
  res.json({ ok: true });
});

// GET /guilds/:guildId/integrations/:id/logs — recent logs
integrationsRouter.get('/:id/logs', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as Record<string, string>;
  const logs = await db.select().from(integrationLogs)
    .where(eq(integrationLogs.integrationId, id))
    .orderBy(desc(integrationLogs.createdAt))
    .limit(50);
  res.json(logs);
});
