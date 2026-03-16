import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { spatialRooms } from '../db/schema/spatial-rooms';
import { channels } from '../db/schema/channels';
import { guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';

export const spatialRoomsRouter = Router({ mergeParams: true });

// GET /channels/:channelId/spatial-room — get room config (create default if none)
spatialRoomsRouter.get(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const channelId = req.params.channelId as string;

      // Verify channel exists
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' });
        return;
      }

      // Verify guild membership
      if (channel.guildId) {
        const [membership] = await db.select({ id: guildMembers.id }).from(guildMembers)
          .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!)))
          .limit(1);
        if (!membership) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this guild' }); return; }
      }

      // Try to find existing spatial room
      let [room] = await db
        .select()
        .from(spatialRooms)
        .where(eq(spatialRooms.channelId, channelId))
        .limit(1);

      // Create default if none exists
      if (!room) {
        [room] = await db
          .insert(spatialRooms)
          .values({
            channelId,
            name: channel.name || 'Spatial Room',
          })
          .onConflictDoNothing()
          .returning();

        // If onConflictDoNothing returned nothing (race condition), re-fetch
        if (!room) {
          [room] = await db
            .select()
            .from(spatialRooms)
            .where(eq(spatialRooms.channelId, channelId))
            .limit(1);
        }
      }

      res.json(room);
    } catch (err) {
      logger.error('[spatial-rooms] GET error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// PATCH /channels/:channelId/spatial-room — update room settings
spatialRoomsRouter.patch(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const channelId = req.params.channelId as string;
      const { name, width, height, backgroundUrl, gridEnabled, maxParticipants } = req.body as {
        name?: string;
        width?: number;
        height?: number;
        backgroundUrl?: string | null;
        gridEnabled?: boolean;
        maxParticipants?: number;
      };

      // Verify channel exists
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' });
        return;
      }

      // Verify guild membership + MANAGE_CHANNELS permission (simplified: guild member check)
      if (channel.guildId) {
        const [membership] = await db.select({ id: guildMembers.id }).from(guildMembers)
          .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!)))
          .limit(1);
        if (!membership) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this guild' }); return; }
      }

      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name.slice(0, 100);
      if (width !== undefined) updates.width = Math.max(200, Math.min(width, 4000));
      if (height !== undefined) updates.height = Math.max(200, Math.min(height, 4000));
      if (backgroundUrl !== undefined) updates.backgroundUrl = backgroundUrl;
      if (gridEnabled !== undefined) updates.gridEnabled = gridEnabled;
      if (maxParticipants !== undefined) updates.maxParticipants = Math.max(1, Math.min(maxParticipants, 100));

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Nothing to update' });
        return;
      }

      // Upsert: update if exists, otherwise create with defaults + updates
      let [room] = await db
        .select()
        .from(spatialRooms)
        .where(eq(spatialRooms.channelId, channelId))
        .limit(1);

      if (!room) {
        // Create with defaults then apply updates
        [room] = await db
          .insert(spatialRooms)
          .values({
            channelId,
            name: (updates.name as string) || channel.name || 'Spatial Room',
            ...updates,
          })
          .returning();
      } else {
        [room] = await db
          .update(spatialRooms)
          .set(updates)
          .where(eq(spatialRooms.channelId, channelId))
          .returning();
      }

      res.json(room);
    } catch (err) {
      logger.error('[spatial-rooms] PATCH error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
