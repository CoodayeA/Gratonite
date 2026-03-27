/**
 * routes/guild-backup.ts — Server backup & restore (item 108)
 * Mounted at /api/v1/guilds/:guildId/backups
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { guildBackups } from '../db/schema/guild-backups';
import { guilds } from '../db/schema/guilds';
import { channels } from '../db/schema/channels';
import { roles } from '../db/schema/roles';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';
import { normalizeError } from '../lib/errors';

export const guildBackupRouter = Router({ mergeParams: true });

/** GET / — List backups */
guildBackupRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  try {
    const backups = await db.select({
      id: guildBackups.id,
      name: guildBackups.name,
      sizeBytes: guildBackups.sizeBytes,
      createdAt: guildBackups.createdAt,
    }).from(guildBackups).where(eq(guildBackups.guildId, guildId)).orderBy(desc(guildBackups.createdAt));

    res.json(backups);
  } catch (err) {
    const normalized = normalizeError(err);
    if (normalized.code === 'FEATURE_UNAVAILABLE') {
      res.json([]);
      return;
    }
    throw err;
  }
});

/** POST / — Create backup */
guildBackupRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  const { name } = req.body as { name?: string };

  // Snapshot guild structure
  const [guild] = await db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1);
  if (!guild) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const guildChannels = await db.select().from(channels).where(eq(channels.guildId, guildId));
  const guildRoles = await db.select().from(roles).where(eq(roles.guildId, guildId));

  const data = {
    guild: { name: guild.name, description: guild.description, iconHash: guild.iconHash },
    channels: guildChannels.map(c => ({
      name: c.name, type: c.type, position: c.position, parentId: c.parentId, topic: c.topic,
    })),
    roles: guildRoles.map(r => ({
      name: r.name, color: r.color, position: r.position,
      permissions: r.permissions.toString(), hoist: r.hoist, mentionable: r.mentionable,
    })),
    exportedAt: new Date().toISOString(),
    version: 1,
  };

  const jsonStr = JSON.stringify(data);

  const [backup] = await db.insert(guildBackups).values({
    guildId,
    createdBy: req.userId!,
    name: name || `Backup ${new Date().toISOString().slice(0, 10)}`,
    data,
    sizeBytes: Buffer.byteLength(jsonStr),
  }).returning();

  res.status(201).json(backup);
});

/** GET /:backupId — Download backup data */
guildBackupRouter.get('/:backupId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const backupId = req.params.backupId as string;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  const [backup] = await db.select().from(guildBackups)
    .where(and(eq(guildBackups.id, backupId), eq(guildBackups.guildId, guildId))).limit(1);

  if (!backup) { res.status(404).json({ code: 'NOT_FOUND' }); return; }
  res.json(backup);
});

/** DELETE /:backupId — Delete backup */
guildBackupRouter.delete('/:backupId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const backupId = req.params.backupId as string;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  await db.delete(guildBackups).where(and(eq(guildBackups.id, backupId), eq(guildBackups.guildId, guildId)));
  res.json({ code: 'OK' });
});
