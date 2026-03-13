/**
 * routes/emojis.ts — Express router for guild emoji endpoints.
 *
 * Mounted at /api/v1/guilds/:guildId/emojis by src/routes/index.ts.
 *
 * Endpoints:
 *   GET    /                — List all custom emojis for the guild
 *   POST   /                — Upload a new custom emoji (image + name)
 *   DELETE /:emojiId        — Delete a custom emoji
 *
 * @module routes/emojis
 */

import path from 'path';
import { logger } from '../lib/logger';
import fs from 'fs';
import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';

import { db } from '../db/index';
import { guildEmojis } from '../db/schema/emojis';
import { guilds, guildMembers } from '../db/schema/guilds';
import { files } from '../db/schema/files';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';
import { AppError } from '../lib/errors.js';

// mergeParams: true so we can read :guildId from the parent mount
export const emojisRouter = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_EMOJIS_PER_GUILD = 50;
const MAX_EMOJI_SIZE = 256 * 1024; // 256 KB
const ALLOWED_MIME_TYPES = ['image/png', 'image/gif', 'image/jpeg'];

// ---------------------------------------------------------------------------
// Upload directory (reuse the same uploads dir as files.ts)
// ---------------------------------------------------------------------------

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Multer config
// ---------------------------------------------------------------------------

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_EMOJI_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File must be PNG, GIF, or JPEG'));
    }
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function handleAppError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
  } else if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Emoji file must be 256 KB or smaller' });
    } else {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: err.message });
    }
  } else if (err instanceof Error && err.message === 'File must be PNG, GIF, or JPEG') {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: err.message });
  } else {
    logger.error('[emojis] unexpected error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}

async function requireMember(guildId: string, userId: string): Promise<void> {
  const [membership] = await db
    .select({ id: guildMembers.id })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
    .limit(1);

  if (!membership) {
    throw new AppError(403, 'You are not a member of this guild', 'FORBIDDEN');
  }
}

async function requireOwner(guildId: string, userId: string): Promise<void> {
  const [guild] = await db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1);

  if (!guild) {
    throw new AppError(404, 'Guild not found', 'NOT_FOUND');
  }

  if (guild.ownerId !== userId) {
    throw new AppError(403, 'Only the guild owner can manage emojis', 'FORBIDDEN');
  }
}

// ---------------------------------------------------------------------------
// GET / — List guild emojis
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/guilds/:guildId/emojis
 *
 * Return all custom emojis for the guild. User must be a member.
 *
 * @auth    requireAuth, requireMember
 * @returns 200 Array of { id, guildId, name, imageHash, uploadedBy, createdAt }
 */
emojisRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    await requireMember(guildId, req.userId!);

    const rows = await db
      .select()
      .from(guildEmojis)
      .where(eq(guildEmojis.guildId, guildId));

    // Map imageUrl (which stores the file record ID) to imageHash for the frontend
    const result = rows.map(row => ({
      id: row.id,
      guildId: row.guildId,
      name: row.name,
      imageHash: row.imageUrl, // imageUrl column stores the file record ID
      uploadedBy: row.uploadedBy,
      createdAt: row.createdAt,
    }));

    res.status(200).json(result);
  } catch (err) {
    handleAppError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST / — Upload a new emoji
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/guilds/:guildId/emojis
 *
 * Upload a new custom emoji. Requires guild membership (owner check for now).
 * Max 50 emojis per guild. File must be PNG/GIF/JPEG, max 256 KB.
 *
 * @auth    requireAuth
 * @body    multipart/form-data { name: string, file: File }
 * @returns 201 { id, guildId, name, imageHash, uploadedBy, createdAt }
 */
emojisRouter.post('/', requireAuth, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    await requireMember(guildId, req.userId!);

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_EMOJIS))) {
      throw new AppError(403, 'Missing MANAGE_EMOJIS permission', 'FORBIDDEN');
    }

    // Validate name
    const name = (req.body?.name ?? '').trim();
    if (!name || name.length < 2 || name.length > 32) {
      throw new AppError(400, 'Emoji name must be 2-32 characters', 'VALIDATION_ERROR');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      throw new AppError(400, 'Emoji name must be alphanumeric (underscores allowed)', 'VALIDATION_ERROR');
    }

    // Check file was provided
    if (!req.file) {
      throw new AppError(400, 'No file provided. Use multipart/form-data with field "file".', 'VALIDATION_ERROR');
    }

    // Check emoji limit
    const existing = await db
      .select({ id: guildEmojis.id })
      .from(guildEmojis)
      .where(eq(guildEmojis.guildId, guildId));

    if (existing.length >= MAX_EMOJIS_PER_GUILD) {
      // Clean up uploaded file
      fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename));
      throw new AppError(400, `Emoji limit reached (max ${MAX_EMOJIS_PER_GUILD})`, 'EMOJI_LIMIT');
    }

    // Check for duplicate name
    const duplicate = await db
      .select({ id: guildEmojis.id })
      .from(guildEmojis)
      .where(and(eq(guildEmojis.guildId, guildId), eq(guildEmojis.name, name)))
      .limit(1);

    if (duplicate.length > 0) {
      fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename));
      throw new AppError(400, 'An emoji with this name already exists', 'DUPLICATE_NAME');
    }

    // Insert a file record (same pattern as files.ts)
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl}/api/v1/files/${req.file.filename.split('.')[0]}`;

    const [fileRecord] = await db
      .insert(files)
      .values({
        uploaderId: req.userId!,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        storageKey: req.file.filename,
        url: fileUrl,
      })
      .returning();

    // Insert emoji record — store file record ID in imageUrl column
    const [emoji] = await db
      .insert(guildEmojis)
      .values({
        guildId,
        name,
        imageUrl: fileRecord.id,
        uploadedBy: req.userId!,
      })
      .returning();

    res.status(201).json({
      id: emoji.id,
      guildId: emoji.guildId,
      name: emoji.name,
      imageHash: fileRecord.id, // frontend uses this as /files/:imageHash
      uploadedBy: emoji.uploadedBy,
      createdAt: emoji.createdAt,
    });
  } catch (err) {
    handleAppError(res, err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:emojiId — Delete an emoji
// ---------------------------------------------------------------------------

/**
 * DELETE /api/v1/guilds/:guildId/emojis/:emojiId
 *
 * Delete a custom emoji. Only the guild owner can delete emojis.
 *
 * @auth    requireAuth, requireOwner
 * @returns 200 { message: 'Emoji deleted' }
 */
emojisRouter.delete('/:emojiId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, emojiId } = req.params as Record<string, string>;
    await requireMember(guildId, req.userId!);

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_EMOJIS))) {
      throw new AppError(403, 'Missing MANAGE_EMOJIS permission', 'FORBIDDEN');
    }

    // Verify emoji exists and belongs to this guild
    const [emoji] = await db
      .select()
      .from(guildEmojis)
      .where(and(eq(guildEmojis.id, emojiId), eq(guildEmojis.guildId, guildId)))
      .limit(1);

    if (!emoji) {
      throw new AppError(404, 'Emoji not found', 'NOT_FOUND');
    }

    // Delete the emoji record
    await db.delete(guildEmojis).where(eq(guildEmojis.id, emojiId));

    // Optionally clean up the file record and disk file
    if (emoji.imageUrl) {
      const [fileRecord] = await db
        .select()
        .from(files)
        .where(eq(files.id, emoji.imageUrl))
        .limit(1);

      if (fileRecord) {
        const filePath = path.join(UPLOADS_DIR, fileRecord.storageKey);
        await db.delete(files).where(eq(files.id, fileRecord.id));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    res.status(200).json({ code: 'OK', message: 'Emoji deleted' });
  } catch (err) {
    handleAppError(res, err);
  }
});
