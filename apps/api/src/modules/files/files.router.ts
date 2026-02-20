import { Router } from 'express';
import multer from 'multer';
import type { AppContext } from '../../lib/context.js';
import { requireAuth } from '../../middleware/auth.js';
import { uploadRateLimiter } from '../../middleware/rate-limiter.js';
import { createFilesService } from './files.service.js';
import { uploadFileSchema } from './files.schemas.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max (per-purpose limits enforced in service)
});

export function filesRouter(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx);
  const filesService = createFilesService(ctx);

  // ── POST /files/upload — Upload a file ───────────────────────────────

  router.post('/files/upload', auth, uploadRateLimiter, upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ code: 'NO_FILE', message: 'No file provided' });
    }

    const parsed = uploadFileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    try {
      const result = await filesService.uploadFile(req.file, parsed.data, req.user!.userId);
      res.status(201).json(result);
    } catch (err: any) {
      if (err.code === 'FILE_TOO_LARGE') {
        return res.status(413).json({
          code: 'FILE_TOO_LARGE',
          message: `File exceeds maximum size of ${Math.round(err.maxSize / 1024)}KB for ${parsed.data.purpose}`,
        });
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(415).json({ code: 'INVALID_FILE_TYPE', message: err.message });
      }
      throw err;
    }
  });

  // ── GET /files/:fileId — Get pending upload info ─────────────────────

  router.get('/files/:fileId', auth, async (req, res) => {
    const upload = await filesService.getPendingUpload(req.params.fileId);
    if (!upload) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'File not found or expired' });
    }
    res.json(upload);
  });

  return router;
}
