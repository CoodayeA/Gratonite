/**
 * document-templates.ts — REST endpoints for document templates (per-guild).
 *
 * Routes:
 *   GET    /guilds/:guildId/document-templates              — list templates
 *   POST   /guilds/:guildId/document-templates              — create custom template
 *   DELETE /guilds/:guildId/document-templates/:templateId   — delete template
 *   POST   /channels/:channelId/document/apply-template      — apply template to document
 */
import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { documentTemplates } from '../db/schema/document-templates';
import { collaborativeDocuments } from '../db/schema/collaborative-documents';
import { channels, dmChannelMembers } from '../db/schema/channels';
import { guilds, guildMembers } from '../db/schema/guilds';
import { roles, memberRoles, Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';

export const documentTemplatesRouter = Router();

/**
 * Check if a user has MANAGE_CHANNELS permission in a guild.
 * Guild owner always passes.
 */
async function verifyManageChannels(guildId: string, userId: string): Promise<boolean> {
  // Check guild owner
  const [guild] = await db.select({ ownerId: guilds.ownerId }).from(guilds)
    .where(eq(guilds.id, guildId)).limit(1);
  if (!guild) return false;
  if (guild.ownerId === userId) return true;

  // Check roles
  const userRoles = await db.select({ permissions: roles.permissions })
    .from(memberRoles)
    .innerJoin(roles, eq(memberRoles.roleId, roles.id))
    .where(and(eq(memberRoles.userId, userId), eq(memberRoles.guildId, guildId)));

  const requiredPerms = Permissions.ADMINISTRATOR | Permissions.MANAGE_CHANNELS;
  for (const r of userRoles) {
    if (BigInt(r.permissions) & requiredPerms) return true;
  }

  return false;
}

/**
 * Verify the user is a member of the guild.
 */
async function verifyGuildMembership(guildId: string, userId: string): Promise<boolean> {
  const [gm] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId))).limit(1);
  return !!gm;
}

// GET /guilds/:guildId/document-templates — list built-in + custom templates
documentTemplatesRouter.get('/guilds/:guildId/document-templates', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;

    if (!await verifyGuildMembership(guildId, req.userId!)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this guild' });
      return;
    }

    const templates = await db.select().from(documentTemplates)
      .where(eq(documentTemplates.guildId, guildId));

    res.json(templates);
  } catch (err) {
    logger.error('[document-templates] GET list error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /guilds/:guildId/document-templates — create custom template
documentTemplatesRouter.post('/guilds/:guildId/document-templates', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const { name, description, icon, blocks } = req.body as {
      name: string;
      description?: string;
      icon?: string;
      blocks?: any[];
    };

    if (!await verifyGuildMembership(guildId, req.userId!)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this guild' });
      return;
    }

    if (!await verifyManageChannels(guildId, req.userId!)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Requires MANAGE_CHANNELS permission' });
      return;
    }

    if (!name || !name.trim()) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'Template name is required' });
      return;
    }

    const [template] = await db.insert(documentTemplates)
      .values({
        guildId,
        name: name.trim().slice(0, 100),
        description: description?.trim() || null,
        icon: icon?.trim().slice(0, 50) || null,
        blocks: blocks || [],
        isBuiltin: false,
        createdBy: req.userId!,
      })
      .returning();

    res.status(201).json(template);
  } catch (err) {
    logger.error('[document-templates] POST create error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /guilds/:guildId/document-templates/:templateId — delete template
documentTemplatesRouter.delete('/guilds/:guildId/document-templates/:templateId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const templateId = req.params.templateId as string;

    if (!await verifyGuildMembership(guildId, req.userId!)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this guild' });
      return;
    }

    if (!await verifyManageChannels(guildId, req.userId!)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Requires MANAGE_CHANNELS permission' });
      return;
    }

    const [template] = await db.select().from(documentTemplates)
      .where(and(eq(documentTemplates.id, templateId), eq(documentTemplates.guildId, guildId)))
      .limit(1);

    if (!template) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Template not found' });
      return;
    }

    await db.delete(documentTemplates)
      .where(eq(documentTemplates.id, templateId));

    res.json({ success: true });
  } catch (err) {
    logger.error('[document-templates] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /channels/:channelId/document/apply-template — apply a template to a document
documentTemplatesRouter.post('/channels/:channelId/document/apply-template', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const { templateId } = req.body as { templateId: string };

    if (!templateId) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'templateId is required' });
      return;
    }

    // Verify user has access to this channel
    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    if (!channel) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' });
      return;
    }

    // Verify access: DM channels check membership, guild channels check guild membership + permissions
    if (channel.type === 'DM' || channel.type === 'GROUP_DM') {
      const [membership] = await db.select({ id: dmChannelMembers.id }).from(dmChannelMembers)
        .where(and(eq(dmChannelMembers.channelId, channelId), eq(dmChannelMembers.userId, req.userId!))).limit(1);
      if (!membership) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'No access to this channel' });
        return;
      }
    } else if (channel.guildId) {
      if (!await verifyGuildMembership(channel.guildId, req.userId!)) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this guild' });
        return;
      }
      if (!await verifyManageChannels(channel.guildId, req.userId!)) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Requires MANAGE_CHANNELS permission' });
        return;
      }
    } else {
      res.status(403).json({ code: 'FORBIDDEN', message: 'No access to this channel' });
      return;
    }

    // Fetch the template
    const [template] = await db.select().from(documentTemplates)
      .where(eq(documentTemplates.id, templateId))
      .limit(1);

    if (!template) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Template not found' });
      return;
    }

    // Find or create the document
    let [doc] = await db.select({ id: collaborativeDocuments.id, version: collaborativeDocuments.version })
      .from(collaborativeDocuments)
      .where(eq(collaborativeDocuments.channelId, channelId))
      .limit(1);

    if (!doc) {
      [doc] = await db.insert(collaborativeDocuments)
        .values({
          channelId,
          title: template.name,
          content: '',
          blocks: template.blocks || [],
          icon: template.icon,
          createdBy: req.userId!,
        })
        .returning();
      // Bump template usage count
      await db.update(documentTemplates)
        .set({ usageCount: template.usageCount + 1, updatedAt: new Date() })
        .where(eq(documentTemplates.id, templateId));
      res.json(doc);
      return;
    }

    // Apply template blocks to existing document
    const [updated] = await db.update(collaborativeDocuments)
      .set({
        blocks: template.blocks || [],
        icon: template.icon,
        version: doc.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(collaborativeDocuments.id, doc.id))
      .returning();

    // Bump template usage count
    await db.update(documentTemplates)
      .set({ usageCount: template.usageCount + 1, updatedAt: new Date() })
      .where(eq(documentTemplates.id, templateId));

    res.json(updated);
  } catch (err) {
    logger.error('[document-templates] POST apply-template error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
