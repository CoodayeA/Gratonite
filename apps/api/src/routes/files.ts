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
import { logger } from '../lib/logger';
import fs from 'fs';
import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { eq, or, like } from 'drizzle-orm';

import { db } from '../db/index';
import { files } from '../db/schema/files';
import { requireAuth } from '../middleware/auth';
import { publicFileRateLimit } from '../middleware/rateLimit';

export const filesRouter = Router();

function setFileErrorNoStore(res: Response): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

// ---------------------------------------------------------------------------
// MIME type allowlist — only these prefixes/types are accepted for upload
// ---------------------------------------------------------------------------

const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/'];
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',  // Windows/Chrome zip alias
  'application/x-zip',
  'application/x-compressed',
  'multipart/x-zip',
  'application/json',
  /** E2E clients upload ciphertext as opaque binary (see web encryptFile → encrypted.bin). */
  'application/octet-stream',
]);

/**
 * Dangerous file extensions that must never be uploaded, regardless of MIME type.
 * These can be executed by the OS or browser if a user downloads and opens them.
 */
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.vbs', '.vbe', '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh',
  '.ps1', '.ps2', '.psc1', '.psc2', '.msh', '.msh1', '.msh2',
  '.inf', '.reg', '.rgs', '.sct', '.shb', '.shs',
  '.lnk', '.dll', '.sys', '.cpl', '.hta', '.html', '.htm',
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
  '.bin': ['application/octet-stream'],
  '.zip': ['application/zip', 'application/x-zip-compressed', 'application/x-zip', 'application/x-compressed', 'multipart/x-zip'],
};

/**
 * Allowed file extensions (default-deny). Only files with these extensions
 * will be accepted for upload.
 */
const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif',
  '.mp4', '.webm', '.mov', '.avi', '.mkv',
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a',
  '.pdf', '.txt', '.md', '.json', '.csv', '.xml',
  '.zip', '.tar', '.gz',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.bin', // E2E encrypted blob uploads (paired with application/octet-stream)
]);

const FILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FALLBACK_MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.bin': 'application/octet-stream',
};

/**
 * Cross-validate extension against claimed MIME type. Returns true if the
 * extension is in the allowed set and is consistent with the MIME type
 * (or not in our known map). Unknown extensions are rejected.
 */
function extensionMatchesMime(ext: string, mimeType: string): boolean {
  const lower = ext.toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(lower)) return false; // reject unknown extensions
  const expected = EXT_MIME_MAP[lower];
  if (!expected) return true; // allowed extension but no MIME mapping — accept
  return expected.includes(mimeType.toLowerCase());
}

/**
 * Magic byte signatures for common file types.
 * Maps MIME type prefixes to arrays of [offset, expected bytes].
 */
const MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4E, 0x47] },           // ‰PNG
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },                  // ÿØÿ
  { mime: 'image/gif',  bytes: [0x47, 0x49, 0x46, 0x38] },           // GIF8
  { mime: 'image/webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // WEBP at offset 8
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },      // %PDF
  { mime: 'application/zip', bytes: [0x50, 0x4B, 0x03, 0x04] },      // PK♥♦ (ZIP local file header)
];

/**
 * Validate that a file's leading bytes match its claimed MIME type.
 * Returns true if the magic bytes match or if we don't have a signature for this type.
 */
function validateMagicBytes(filePath: string, claimedMime: string): boolean {
  const entry = MAGIC_BYTES.find(m => claimedMime.toLowerCase().startsWith(m.mime));
  if (!entry) return true; // no signature to check — allow

  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(entry.bytes.length);
    const bytesRead = fs.readSync(fd, buf, 0, entry.bytes.length, entry.offset ?? 0);
    if (bytesRead < entry.bytes.length) return false;
    return entry.bytes.every((b, i) => buf[i] === b);
  } finally {
    fs.closeSync(fd);
  }
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

function resolveUploadPath(storageKey: string): string | null {
  const filePath = path.join(UPLOADS_DIR, storageKey);
  const uploadsRoot = path.resolve(UPLOADS_DIR);
  const resolved = path.resolve(filePath);
  const relative = path.relative(uploadsRoot, resolved);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? resolved : null;
}

function findOrphanUpload(fileId: string): { storageKey: string; filePath: string; mimeType: string } | null {
  if (!FILE_ID_PATTERN.test(fileId)) {
    return null;
  }

  for (const [ext, mimeType] of Object.entries(FALLBACK_MIME_BY_EXT)) {
    const storageKey = `${fileId}${ext}`;
    const filePath = resolveUploadPath(storageKey);
    if (filePath && fs.existsSync(filePath)) {
      return { storageKey, filePath, mimeType };
    }
  }

  return null;
}

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
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      cb(new Error(`File type ${ext} is not allowed`));
      return;
    }
    if (!isAllowedMimeType(file.mimetype)) {
      cb(new Error(`MIME type ${file.mimetype} is not allowed`));
      return;
    }
    cb(null, true);
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
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'File exceeds the 25 MB size limit.' });
          } else {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: err.message });
          }
          return;
        }
        // fileFilter errors come as plain Error
        res.status(400).json({ code: 'VALIDATION_ERROR', message: err.message });
        return;
      }
      next();
    });
  },
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

    // Validate magic bytes match claimed MIME type
    if (!validateMagicBytes(req.file.path, claimedMime)) {
      fs.unlink(req.file.path, () => {});
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'File content does not match its claimed type.',
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
      logger.error('[files] upload error:', err);
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
filesRouter.get('/:fileId', publicFileRateLimit, (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, async (req: Request, res: Response): Promise<void> => {
  let { fileId } = req.params as Record<string, string>;

  // Support _static suffix: serve the first frame of an animated GIF as a static PNG.
  // If the _static version doesn't exist on disk, fall back to serving the original.
  const isStaticRequest = fileId.endsWith('_static');
  if (isStaticRequest) {
    fileId = fileId.replace(/_static$/, '');
  }

  try {
    // Look up by storageKey prefix (the URL contains the storage UUID, not the DB row ID).
    // storageKey format: "<uuid>.<ext>" — the URL contains only the UUID portion.
    // Also try exact DB id match for forward compatibility.
    const [fileRecord] = await db
      .select()
      .from(files)
      .where(or(
        eq(files.id, fileId),
        eq(files.storageKey, fileId),
        like(files.storageKey, `${fileId}.%`),
      ))
      .limit(1);

    if (!fileRecord) {
      const orphanUpload = findOrphanUpload(fileId);
      if (orphanUpload) {
        logger.warn('[files] serving upload without files row', {
          fileId,
          storageKey: orphanUpload.storageKey,
        });
        res.setHeader('Content-Type', orphanUpload.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${orphanUpload.storageKey}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.sendFile(orphanUpload.filePath);
        return;
      }
      setFileErrorNoStore(res);
      res.status(404).json({ code: 'NOT_FOUND', message: 'File not found' });
      return;
    }

    const filePath = resolveUploadPath(fileRecord.storageKey);

    // Path traversal defense: ensure resolved path stays within UPLOADS_DIR
    if (!filePath) {
      setFileErrorNoStore(res);
      res.status(403).json({ code: 'FORBIDDEN', message: 'Invalid path'  });
      return;
    }

    // Verify the file actually exists on disk before attempting to send it.
    if (!fs.existsSync(filePath)) {
      setFileErrorNoStore(res);
      res.status(404).json({ code: 'NOT_FOUND', message: 'File not found on disk' });
      return;
    }

    // If a _static version was requested for an animated GIF, try to serve a static PNG.
    if (isStaticRequest && fileRecord.mimeType === 'image/gif') {
      const ext = path.extname(fileRecord.storageKey);
      const staticKey = fileRecord.storageKey.replace(ext, '_static.png');
      const staticPath = path.join(UPLOADS_DIR, staticKey);
      if (fs.existsSync(staticPath)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.sendFile(staticPath);
        return;
      }
      // Fall through to serve the original animated GIF if no static version exists
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
    logger.error('[files] serve error:', err);
    setFileErrorNoStore(res);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to serve file' });
  }
});
