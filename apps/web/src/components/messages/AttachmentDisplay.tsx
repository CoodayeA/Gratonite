import { useState } from 'react';
import { ImageLightbox } from '../ui/ImageLightbox';

interface Attachment {
  id: string;
  filename: string;
  url: string;
  proxyUrl?: string | null;
  size: number;
  mimeType?: string;
  contentType?: string;
}

interface AttachmentDisplayProps {
  attachments: Attachment[];
}

function resolveAttachmentUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (rawUrl.startsWith('/')) return rawUrl;

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname;
    const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    const filename = parsed.pathname.split('/').pop();
    if (!filename) return rawUrl;

    const isGratoniteHost =
      host === 'gratonite.chat' ||
      host === 'www.gratonite.chat' ||
      host === 'api.gratonite.chat' ||
      host.endsWith('.gratonite.chat');
    const looksLikeObjectStoragePath =
      /^\/(?:uploads|avatars|icons|banners|attachments|files)\//i.test(parsed.pathname) ||
      parsed.pathname.split('/').length >= 3;

    if (isLoopback || (isGratoniteHost && looksLikeObjectStoragePath)) {
      return `/api/v1/files/${encodeURIComponent(filename)}`;
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentDisplay({ attachments }: AttachmentDisplayProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string | undefined>(undefined);

  if (!attachments.length) return null;

  return (
    <div className="attachment-display">
      {attachments.map((att) => {
        const mediaType = att.mimeType ?? att.contentType ?? '';
        const sourceUrl = att.proxyUrl || att.url;
        const resolvedUrl = resolveAttachmentUrl(sourceUrl);
        const fileName = att.filename || sourceUrl.split('/').pop() || 'attachment';
        const isImage =
          mediaType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|avif|heic|heif)$/i.test(fileName);
        const isVideo =
          mediaType.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(fileName);

        if (isImage) {
          return (
            <button
              key={att.id}
              type="button"
              className="attachment-image-link"
              onClick={() => {
                setLightboxSrc(resolvedUrl);
                setLightboxAlt(fileName);
              }}
            >
              <img src={resolvedUrl} alt={fileName} className="attachment-image" loading="lazy" />
            </button>
          );
        }

        if (isVideo) {
          return (
            <a key={att.id} href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="attachment-image-link">
              <video
                src={resolvedUrl}
                className="attachment-image"
                controls
                preload="metadata"
                playsInline
              />
            </a>
          );
        }

        return (
          <a key={att.id} href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="attachment-file">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <div className="attachment-file-info">
              <span className="attachment-file-name">{fileName}</span>
              <span className="attachment-file-size">{formatFileSize(att.size)}</span>
            </div>
          </a>
        );
      })}

      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt={lightboxAlt}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </div>
  );
}
