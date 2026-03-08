/**
 * middleware/federation-sanitize.ts — Content sanitization for inbound federation.
 */

import { Request, Response, NextFunction } from 'express';

/** Maximum message content length from federated sources. */
const MAX_CONTENT_LENGTH = 4000;

/** Maximum request body size in bytes. */
const MAX_BODY_SIZE = 1_000_000; // 1MB

/** Dangerous URL schemes to reject. */
const DANGEROUS_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:'];

/**
 * Strip HTML tags from a string (basic sanitization).
 */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Validate URLs — must be HTTPS (or HTTP for dev), no dangerous schemes.
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (DANGEROUS_SCHEMES.some(scheme => url.toLowerCase().startsWith(scheme))) return false;
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Sanitize an inbound federation message payload.
 * Strips HTML, validates URLs, enforces size limits.
 */
export function sanitizeFederationContent(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...payload };

  // Sanitize content
  if (typeof sanitized.content === 'string') {
    sanitized.content = stripHtml(sanitized.content).slice(0, MAX_CONTENT_LENGTH);
  }

  // Sanitize URLs in attachments
  if (Array.isArray(sanitized.attachments)) {
    sanitized.attachments = (sanitized.attachments as Array<Record<string, unknown>>)
      .filter(a => typeof a.url === 'string' && isValidUrl(a.url as string))
      .map(a => ({
        ...a,
        url: a.url,
        filename: typeof a.filename === 'string' ? a.filename.slice(0, 255) : 'unknown',
      }));
  }

  // Sanitize embeds
  if (Array.isArray(sanitized.embeds)) {
    sanitized.embeds = (sanitized.embeds as Array<Record<string, unknown>>)
      .filter(e => typeof e.url === 'string' && isValidUrl(e.url as string))
      .map(e => ({
        url: e.url,
        title: typeof e.title === 'string' ? stripHtml(e.title).slice(0, 256) : undefined,
        description: typeof e.description === 'string' ? stripHtml(e.description).slice(0, 1000) : undefined,
        image: typeof e.image === 'string' && isValidUrl(e.image) ? e.image : undefined,
        siteName: typeof e.siteName === 'string' ? stripHtml(e.siteName).slice(0, 100) : undefined,
      }));
  }

  return sanitized;
}

/**
 * Express middleware that rejects oversized federation request bodies
 * and sanitizes incoming content.
 */
export function federationSanitizeMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check body size (Content-Length header)
  const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
  if (contentLength > MAX_BODY_SIZE) {
    res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: `Request body exceeds ${MAX_BODY_SIZE} bytes` });
    return;
  }

  // Sanitize the body payload if present
  if (req.body && typeof req.body === 'object' && req.body.payload) {
    req.body.payload = sanitizeFederationContent(req.body.payload);
  }

  next();
}
