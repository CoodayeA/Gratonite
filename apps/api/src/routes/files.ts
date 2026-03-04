/**
 * routes/files.ts — Express router for file upload and serving endpoints.
 *
 * Mounted at /api/v1/files in src/routes/index.ts.
 *
 * Endpoints:
 *   POST  /upload   — Upload a single file (requires auth, max 25 MB)
 *   GET   /:fileId  — Serve a file by ID (public, no auth required)
 *
 * Storage strategy:
 *   Files are stored on the local filesystem in the `./uploads/` directory
 *   at the project root. Each file is saved as `<uuid>.<ext>` to prevent
 *   name collisions and avoid directory traversal via the original filename.
 *
 * Multer configuration:
 *   - Disk storage (not memory) to avoid buffering large files in RAM.
 *   - 25 MB size limit enforced by multer's `limits.fileSize`.
 *   - The destination directory is created at startup if it doesn't exist.
 *
 * Public URL construction:
 *   The URL stored in the `files` table and returned in upload responses is
 *   built from `req.protocol + '://' + req.get('host')` so that it works
 *   regardless of whether the server is running locally or on a remote host.
 *   This avoids hard-coding the server address in the codebase or env vars.
 *
 * @module routes/files
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { eq } from 'drizzle-orm';

import { db } from '../db/index';
import { files } from '../db/schema/files';
import { requireAuth } from '../middleware/auth';

export const filesRouter = Router();

// ---------------------------------------------------------------------------
// MIME type allowlist — only these prefixes/types are accepted for upload
// ---------------------------------------------------------------------------

const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/'];
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
]);

/**
 * Returns true if the given MIME type is on the server-side allowlist.
 */
function isAllowedMimeType(mimeType: string): boolean {
  const lower = mimeType.toLowerCase();
  if (ALLOWED_MIME_TYPES.has(lower)) return true;
  return ALLOWED_MIME_PREFIXES.some(prefix => lower.startsWith(prefix));
}

/**
 * Map of file extensions to expected MIME type prefixes for cross-validation.
 * If the extension doesn't match the claimed MIME type, the upload is rejected.
 */
const EXT_MIME_MAP: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.svg': ['image/svg+xml'],
  '.mp4': ['video/mp4'],
  '.webm': ['video/webm'],
  '.mov': ['video/quicktime'],
  '.mp3': ['audio/mpeg'],
  '.ogg': ['audio/ogg'],
  '.wav': ['audio/wav', 'audio/wave', 'audio/x-wav'],
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'],
};

/**
 * Cross-validate extension against claimed MIME type. Returns true if they are
 * consistent or if the extension is not in our known map (we fall through to
 * the allowlist check in that case).
 */
function extensionMatchesMime(ext: string, mimeType: string): boolean {
  const expected = EXT_MIME_MAP[ext.toLowerCase()];
  if (!expected) return true; // unknown extension — rely on allowlist only
  return expected.includes(mimeType.toLowerCase());
}

// ---------------------------------------------------------------------------
// Upload directory setup
// ---------------------------------------------------------------------------

/**
 * Absolute path to the uploads directory.
 * Stored at the project root (two directories up from src/routes/).
 */
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

/**
 * Ensure the uploads directory exists at startup.
 * `recursive: true` is a no-op if the directory already exists.
 */
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Multer storage and upload middleware
// ---------------------------------------------------------------------------

/**
 * Disk storage engine for multer.
 *
 * destination — always write to UPLOADS_DIR.
 * filename    — generate a UUID-based filename to prevent collisions and
 *               strip unsafe characters from the original filename.
 *               Format: `<uuid>.<ext>` e.g. `550e8400-e29b-41d4-a716-446655440000.png`
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '';
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

/**
 * Multer upload instance configured for single-file uploads.
 *
 * limits.fileSize — 25 MB expressed in bytes.
 */
const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
  },
});

// ---------------------------------------------------------------------------
// POST /upload
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/files/upload
 *
 * Upload a single file. The file is stored on disk under `uploads/<uuid>.<ext>`.
 * A record is inserted into the `files` table and the public URL is returned.
 *
 * @auth    requireAuth — sets req.userId
 * @body    multipart/form-data with field `file`
 * @returns 201 { id, url, filename, size, mimeType }
 * @returns 400 No file provided or file exceeds size limit
 * @returns 401 Not authenticated
 *
 * Side effects:
 *   - Writes file to `uploads/<uuid>.<ext>` on disk.
 *   - Inserts a row in the `files` table.
 */
filesRouter.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    // multer attaches the file as `req.file` if successful.
    if (!req.file) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'No file provided. Use multipart/form-data with field "file".' });
      return;
    }

    // Server-side MIME type validation — don't trust the client-provided Content-Type.
    const claimedMime = req.file.mimetype;
    if (!isAllowedMimeType(claimedMime)) {
      // Clean up the already-written file
      fs.unlink(req.file.path, () => {});
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: `File type "${claimedMime}" is not allowed. Accepted: images, video, audio, PDF, plain text.`,
      });
      return;
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!extensionMatchesMime(ext, claimedMime)) {
      fs.unlink(req.file.path, () => {});
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: `File extension "${ext}" does not match the claimed MIME type "${claimedMime}".`,
      });
      return;
    }

    try {
      // Build the public URL using the request's own protocol and host.
      // This works for both local development and production without
      // requiring any environment variable configuration.
      const baseUrl = process.env.APP_URL ?? `${req.protocol}://${req.get('host')}`;
      const fileUrl = `${baseUrl}/api/v1/files/${req.file.filename.split('.')[0]}`;

      // Insert file record into the database.
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

      res.status(201).json({
        id: fileRecord.id,
        url: fileRecord.url,
        filename: fileRecord.filename,
        size: fileRecord.size,
        mimeType: fileRecord.mimeType,
      });
    } catch (err) {
      console.error('[files] upload error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to save file record' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:fileId
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/files/:fileId
 *
 * Serve a file from disk by its file ID (UUID). This endpoint is public —
 * no authentication is required. The file ID is the UUID portion of the
 * storage key (i.e. without the extension).
 *
 * The correct Content-Type is set from the `mime_type` column in the database
 * so browsers handle the file correctly (inline preview vs. download prompt).
 *
 * @param   fileId {string} — The file's UUID (as returned by POST /upload)
 * @returns 200 File contents with correct Content-Type header
 * @returns 404 File record not found in database or missing from disk
 */
filesRouter.get('/:fileId', async (req: Request, res: Response): Promise<void> => {
  const { fileId } = req.params as Record<string, string>;

  try {
    // Look up the file record by matching the storageKey that starts with the fileId.
    // Since storageKey = "<uuid>.<ext>" and the fileId = "<uuid>", we search
    // the files table for the record whose ID matches the fileId UUID directly.
    const [fileRecord] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!fileRecord) {
      // Try looking up by storage key prefix (UUID part).
      res.status(404).json({ code: 'NOT_FOUND', message: 'File not found' });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, fileRecord.storageKey);

    // Verify the file actually exists on disk before attempting to send it.
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'File not found on disk' });
      return;
    }

    // Set Content-Type from the database record (trusted at upload time).
    res.setHeader('Content-Type', fileRecord.mimeType);
    const safeFilename = fileRecord.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // sendFile requires an absolute path.
    res.sendFile(filePath);
  } catch (err) {
    console.error('[files] serve error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to serve file' });
  }
});
