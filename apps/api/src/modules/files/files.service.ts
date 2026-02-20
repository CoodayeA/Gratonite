import { createHash, randomBytes } from 'crypto';
import sharp from 'sharp';
import type { AppContext } from '../../lib/context.js';
import { BUCKETS, type BucketName } from '../../lib/minio.js';
import { generateId } from '../../lib/snowflake.js';
import { logger } from '../../lib/logger.js';
import type { UploadFileInput } from './files.schemas.js';

/** Map purpose to bucket name */
const PURPOSE_BUCKET: Record<string, BucketName> = {
  upload: 'uploads',
  emoji: 'emojis',
  sticker: 'stickers',
  avatar: 'avatars',
  banner: 'banners',
  'server-icon': 'server-icons',
};

/** Allowed MIME type prefixes per purpose */
const ALLOWED_TYPES: Record<string, string[]> = {
  upload: ['image/', 'video/', 'audio/', 'application/pdf', 'text/'],
  emoji: ['image/png', 'image/gif', 'image/webp'],
  sticker: ['image/png', 'image/apng', 'image/gif', 'image/webp', 'application/json'],
  avatar: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  banner: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  'server-icon': ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
};

/** Max dimensions per purpose */
const MAX_DIMENSIONS: Record<string, { width: number; height: number }> = {
  emoji: { width: 128, height: 128 },
  sticker: { width: 320, height: 320 },
  avatar: { width: 1024, height: 1024 },
  banner: { width: 1920, height: 1080 },
  'server-icon': { width: 1024, height: 1024 },
};

export interface UploadResult {
  id: string;
  bucket: string;
  key: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
  description: string | null;
  spoiler: boolean;
}

export function createFilesService(ctx: AppContext) {
  /**
   * Upload a file to MinIO with optional image processing.
   */
  async function uploadFile(
    file: Express.Multer.File,
    input: UploadFileInput,
    userId: string,
  ): Promise<UploadResult> {
    const bucketName = PURPOSE_BUCKET[input.purpose] ?? 'uploads';
    const bucket = BUCKETS[bucketName];

    // 1. Enforce size limit
    if (file.size > bucket.maxSize) {
      throw Object.assign(new Error('File too large'), {
        code: 'FILE_TOO_LARGE',
        maxSize: bucket.maxSize,
      });
    }

    // 2. Validate MIME type via magic bytes
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(file.buffer);
    const mimeType = detected?.mime ?? file.mimetype;

    const allowed = ALLOWED_TYPES[input.purpose] ?? ALLOWED_TYPES.upload;
    const isAllowed = allowed.some((t) => mimeType.startsWith(t));
    if (!isAllowed) {
      throw Object.assign(new Error(`File type ${mimeType} not allowed for ${input.purpose}`), {
        code: 'INVALID_FILE_TYPE',
      });
    }

    // 3. Process image if applicable
    let buffer = file.buffer;
    let width: number | null = null;
    let height: number | null = null;
    const isImage = mimeType.startsWith('image/') && mimeType !== 'image/gif';
    const isAnimated = mimeType === 'image/gif' || mimeType === 'image/apng';

    if (isImage && !isAnimated) {
      const result = await processImage(buffer, input.purpose);
      buffer = result.buffer;
      width = result.width;
      height = result.height;
    } else if (isAnimated || isImage) {
      // For animated images, just get metadata without processing
      try {
        const meta = await sharp(buffer).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
      } catch {
        // Non-image or unreadable — skip
      }
    }

    // 4. Generate storage key
    const hash = createHash('sha256')
      .update(file.originalname + Date.now() + randomBytes(8).toString('hex'))
      .digest('hex')
      .slice(0, 32);
    const ext = detected?.ext ?? file.originalname.split('.').pop() ?? 'bin';
    const contextDir = input.contextId ?? 'general';
    const key = `${contextDir}/${hash}.${ext}`;

    // 5. Upload to MinIO
    await ctx.minio.putObject(bucket.name, key, buffer, buffer.length, {
      'Content-Type': mimeType,
      'x-amz-meta-uploader': userId,
      'x-amz-meta-original-name': file.originalname,
    });

    // 6. Build result
    const fileId = generateId();
    const url = `${ctx.env.CDN_BASE_URL}/${bucket.name}/${key}`;

    const result: UploadResult = {
      id: fileId,
      bucket: bucket.name,
      key,
      url,
      filename: file.originalname,
      contentType: mimeType,
      size: buffer.length,
      width,
      height,
      description: input.description ?? null,
      spoiler: Boolean(input.spoiler),
    };

    // 7. Store as pending upload in Redis (15 min TTL) for message attachment linking
    await ctx.redis.set(
      `pending_upload:${fileId}`,
      JSON.stringify(result),
      'EX',
      900,
    );

    logger.info({ fileId, bucket: bucket.name, key, size: buffer.length }, 'File uploaded');

    return result;
  }

  /**
   * Process an image: strip EXIF, resize, convert to WebP.
   */
  async function processImage(
    buffer: Buffer,
    purpose: string,
  ): Promise<{ buffer: Buffer; width: number; height: number }> {
    const maxDims = MAX_DIMENSIONS[purpose];

    let pipeline = sharp(buffer).rotate(); // auto-rotate based on EXIF

    if (maxDims) {
      pipeline = pipeline.resize(maxDims.width, maxDims.height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert to WebP for non-animated images (better compression)
    pipeline = pipeline.webp({ quality: 85 });

    const processed = await pipeline.toBuffer({ resolveWithObject: true });

    return {
      buffer: processed.data,
      width: processed.info.width,
      height: processed.info.height,
    };
  }

  /**
   * Get a CDN URL for a file.
   */
  function getFileUrl(bucket: string, key: string): string {
    return `${ctx.env.CDN_BASE_URL}/${bucket}/${key}`;
  }

  /**
   * Delete a file from MinIO.
   */
  async function deleteFile(bucket: string, key: string): Promise<void> {
    await ctx.minio.removeObject(bucket, key);
    logger.info({ bucket, key }, 'File deleted');
  }

  /**
   * Get pending upload metadata from Redis.
   */
  async function getPendingUpload(fileId: string): Promise<UploadResult | null> {
    const data = await ctx.redis.get(`pending_upload:${fileId}`);
    if (!data) return null;
    return JSON.parse(data) as UploadResult;
  }

  /**
   * Remove pending upload from Redis.
   */
  async function clearPendingUpload(fileId: string): Promise<void> {
    await ctx.redis.del(`pending_upload:${fileId}`);
  }

  return {
    uploadFile,
    processImage,
    getFileUrl,
    deleteFile,
    getPendingUpload,
    clearPendingUpload,
  };
}

export type FilesService = ReturnType<typeof createFilesService>;
