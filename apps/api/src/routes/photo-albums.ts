import { Router, Request, Response } from 'express';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../db/index';
import { photoAlbums, photoAlbumItems } from '../db/schema/photo-albums';
import { guilds, guildMembers } from '../db/schema/guilds';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const photoAlbumsRouter = Router({ mergeParams: true });

/** GET /guilds/:guildId/albums — list albums */
photoAlbumsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const albums = await db.select().from(photoAlbums)
    .where(eq(photoAlbums.guildId, guildId))
    .orderBy(desc(photoAlbums.createdAt));

  // Get item counts
  const result = await Promise.all(albums.map(async (album) => {
    const [{ itemCount }] = await db.select({ itemCount: count() }).from(photoAlbumItems)
      .where(eq(photoAlbumItems.albumId, album.id));
    return { ...album, itemCount: Number(itemCount) };
  }));

  res.json(result);
});

/** POST /guilds/:guildId/albums — create album */
photoAlbumsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const { name, description } = req.body;
  if (!name) { res.status(400).json({ code: 'BAD_REQUEST', message: 'name is required' }); return; }

  const [album] = await db.insert(photoAlbums).values({
    guildId,
    name,
    description: description || null,
    createdBy: req.userId!,
  }).returning();

  res.status(201).json(album);
});

/** GET /guilds/:guildId/albums/:id — get album with photos */
photoAlbumsRouter.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const albumId = req.params.id as string;

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const [album] = await db.select().from(photoAlbums)
    .where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.guildId, guildId))).limit(1);
  if (!album) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const photos = await db.select().from(photoAlbumItems)
    .where(eq(photoAlbumItems.albumId, albumId))
    .orderBy(desc(photoAlbumItems.createdAt));

  res.json({ ...album, photos });
});

/** POST /guilds/:guildId/albums/:id/photos — add photo */
photoAlbumsRouter.post('/:id/photos', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const albumId = req.params.id as string;

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const [album] = await db.select().from(photoAlbums)
    .where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.guildId, guildId))).limit(1);
  if (!album) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const { fileUrl, caption, messageId } = req.body;
  if (!fileUrl) { res.status(400).json({ code: 'BAD_REQUEST', message: 'fileUrl is required' }); return; }

  const [photo] = await db.insert(photoAlbumItems).values({
    albumId,
    fileUrl,
    caption: caption || null,
    addedBy: req.userId!,
    messageId: messageId || null,
  }).returning();

  res.status(201).json(photo);
});

/** DELETE /guilds/:guildId/albums/:id/photos/:photoId — remove photo */
photoAlbumsRouter.delete('/:id/photos/:photoId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const photoId = req.params.photoId as string;

  const [photo] = await db.select().from(photoAlbumItems).where(eq(photoAlbumItems.id, photoId)).limit(1);
  if (!photo) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  if (photo.addedBy !== req.userId!) {
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_CHANNELS))) {
      res.status(403).json({ code: 'FORBIDDEN' }); return;
    }
  }

  await db.delete(photoAlbumItems).where(eq(photoAlbumItems.id, photoId));
  res.json({ ok: true });
});

/** DELETE /guilds/:guildId/albums/:id — delete album */
photoAlbumsRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const albumId = req.params.id as string;

  const [album] = await db.select().from(photoAlbums)
    .where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.guildId, guildId))).limit(1);
  if (!album) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  // Creator or MANAGE_GUILD can delete
  if (album.createdBy !== req.userId!) {
    const [guild] = await db.select({ ownerId: guilds.ownerId }).from(guilds)
      .where(eq(guilds.id, guildId)).limit(1);
    const isOwner = guild?.ownerId === req.userId!;
    if (!isOwner && !(await hasPermission(req.userId!, guildId, Permissions.MANAGE_CHANNELS))) {
      res.status(403).json({ code: 'FORBIDDEN' }); return;
    }
  }

  await db.delete(photoAlbums).where(eq(photoAlbums.id, albumId));
  res.json({ ok: true });
});

/** PATCH /guilds/:guildId/albums/:id — update album */
photoAlbumsRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const albumId = req.params.id as string;

  const [album] = await db.select().from(photoAlbums)
    .where(and(eq(photoAlbums.id, albumId), eq(photoAlbums.guildId, guildId))).limit(1);
  if (!album) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  if (album.createdBy !== req.userId!) {
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_CHANNELS))) {
      res.status(403).json({ code: 'FORBIDDEN' }); return;
    }
  }

  const { name, description, coverUrl } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (coverUrl !== undefined) updates.coverUrl = coverUrl;

  if (Object.keys(updates).length === 0) { res.json(album); return; }

  const [updated] = await db.update(photoAlbums).set(updates)
    .where(eq(photoAlbums.id, albumId)).returning();

  res.json(updated);
});
