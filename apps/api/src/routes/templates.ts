import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../db/index';
import { guildTemplates } from '../db/schema/templates';
import { guilds, guildMembers } from '../db/schema/guilds';
import { channels } from '../db/schema/channels';
import { roles } from '../db/schema/roles';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { hasPermission } from './roles';

export const templatesRouter = Router({ mergeParams: true });

function generateCode(): string {
  return crypto.randomBytes(6).toString('hex');
}

function normalizeChannelName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function snapshotGuild(guildId: string) {
  const guildChannels = await db.select().from(channels).where(eq(channels.guildId, guildId));
  const guildRoles = await db.select().from(roles).where(eq(roles.guildId, guildId));
  return {
    channels: guildChannels.map(c => ({ id: c.id, name: c.name, type: c.type, position: c.position, parentId: c.parentId, topic: c.topic })),
    roles: guildRoles.map(r => ({ name: r.name, color: r.color, position: r.position, permissions: r.permissions.toString(), hoist: r.hoist, mentionable: r.mentionable })),
  };
}

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

/** GET /guilds/:guildId/templates */
templatesRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  const [membership] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!membership) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not a guild member' }); return; }

  const templates = await db.select().from(guildTemplates).where(eq(guildTemplates.guildId, guildId));
  res.json(templates);
});

/** POST /guilds/:guildId/templates */
templatesRouter.post('/', requireAuth, validate(createTemplateSchema), async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  const { name, description } = req.body;
  const serializedGuild = await snapshotGuild(guildId);

  const [template] = await db.insert(guildTemplates).values({
    code: generateCode(),
    guildId,
    creatorId: req.userId!,
    name,
    description: description || null,
    serializedGuild,
  }).returning();

  res.status(201).json(template);
});

/** GET /guilds/templates/:code — public preview (no auth required) */
templatesRouter.get('/templates/:code', async (req: Request, res: Response): Promise<void> => {
  const { code } = req.params as Record<string, string>;
  const [template] = await db.select().from(guildTemplates).where(eq(guildTemplates.code, code)).limit(1);
  if (!template) { res.status(404).json({ code: 'NOT_FOUND', message: 'Template not found' }); return; }

  const [guild] = await db.select({ name: guilds.name, iconHash: guilds.iconHash, description: guilds.description })
    .from(guilds).where(eq(guilds.id, template.guildId)).limit(1);

  res.json({ template, sourceGuild: guild || null });
});

/** POST /guilds/templates/:code — create new guild from template */
const createFromTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

templatesRouter.post('/templates/:code', requireAuth, validate(createFromTemplateSchema), async (req: Request, res: Response): Promise<void> => {
  const { code } = req.params as Record<string, string>;
  const { name } = req.body;

  const [template] = await db.select().from(guildTemplates).where(eq(guildTemplates.code, code)).limit(1);
  if (!template) { res.status(404).json({ code: 'NOT_FOUND', message: 'Template not found' }); return; }

  const snapshot = template.serializedGuild as { channels: any[]; roles: any[] };
  const guildName = name || template.name;

  // Create the guild
  const [newGuild] = await db.insert(guilds).values({
    name: guildName,
    ownerId: req.userId!,
  }).returning();

  // Add owner as member
  await db.insert(guildMembers).values({ guildId: newGuild.id, userId: req.userId! });

  // Create roles from template
  for (const r of snapshot.roles || []) {
    await db.insert(roles).values({
      guildId: newGuild.id,
      name: r.name,
      color: r.color,
      position: r.position,
      permissions: BigInt(r.permissions),
      hoist: r.hoist,
      mentionable: r.mentionable,
    });
  }

  // Create channels from template (without parentId first, then fix parent references)
  const channelIdMap = new Map<string, string>();
  const createdChannelKeys = new Set<string>();
  const sortedChannels = [...(snapshot.channels || [])].sort((a, b) => {
    const aIsCategory = a?.type === 'GUILD_CATEGORY' ? 0 : 1;
    const bIsCategory = b?.type === 'GUILD_CATEGORY' ? 0 : 1;
    if (aIsCategory !== bIsCategory) return aIsCategory - bIsCategory;
    return Number(a?.position || 0) - Number(b?.position || 0);
  });

  for (const c of sortedChannels) {
    const normalizedName = normalizeChannelName(c?.name);
    if (!normalizedName) continue;
    const dedupeKey = `${c?.type}:${normalizedName}:${c?.type === 'GUILD_CATEGORY' ? 'root' : String(c?.parentId || 'root')}`;
    if (createdChannelKeys.has(dedupeKey)) continue;
    const [created] = await db.insert(channels).values({
      guildId: newGuild.id,
      name: String(c?.name ?? '').trim() || normalizedName,
      type: c.type,
      position: c.position,
      topic: c.topic || null,
      parentId: c.type === 'GUILD_CATEGORY' ? null : (c.parentId ? channelIdMap.get(String(c.parentId)) ?? null : null),
    }).returning();
    createdChannelKeys.add(dedupeKey);
    if (c?.id != null) channelIdMap.set(String(c.id), created.id);
    channelIdMap.set(`${normalizedName}:${c.position}`, created.id);
  }

  // Increment usage count
  await db.update(guildTemplates)
    .set({ usageCount: sql`${guildTemplates.usageCount} + 1` })
    .where(eq(guildTemplates.code, code));

  res.status(201).json(newGuild);
});

/** PATCH /guilds/:guildId/templates/:code — re-snapshot current state */
templatesRouter.patch('/:code', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, code } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  const serializedGuild = await snapshotGuild(guildId);
  const { name, description } = req.body || {};

  const updateData: Record<string, unknown> = { serializedGuild, updatedAt: new Date() };
  if (name) updateData.name = name;
  if (description !== undefined) updateData.description = description;

  const [updated] = await db.update(guildTemplates)
    .set(updateData)
    .where(and(eq(guildTemplates.code, code), eq(guildTemplates.guildId, guildId)))
    .returning();

  if (!updated) { res.status(404).json({ code: 'NOT_FOUND', message: 'Template not found' }); return; }
  res.json(updated);
});

/** DELETE /guilds/:guildId/templates/:code */
templatesRouter.delete('/:code', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, code } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  await db.delete(guildTemplates).where(and(eq(guildTemplates.code, code), eq(guildTemplates.guildId, guildId)));
  res.json({ code: 'OK', message: 'Template deleted' });
});
