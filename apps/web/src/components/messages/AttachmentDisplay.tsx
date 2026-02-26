import { useState, useRef, useEffect, useCallback } from 'react';
import { ImageLightbox } from '../ui/ImageLightbox';

interface Attachment {
  id: string;
  filename: string;
  url: string;
  proxyUrl?: string | null;
  size: number;
  mimeType?: string;
  contentType?: string;
  durationSecs?: number | null;
  waveform?: string | null;
  width?: number | null;
  height?: number | null;
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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Decode base64 waveform data into normalized amplitude bars (0-1 range). */
function decodeWaveform(base64: string, barCount: number): number[] {
  try {
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    const maxVal = Math.max(...bytes, 1);
    // Resample to barCount
    const bars: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const idx = Math.floor((i / barCount) * bytes.length);
      bars.push((bytes[idx] ?? 0) / maxVal);
    }
    return bars;
  } catch {
    // Fallback: generate placeholder bars
    return Array.from({ length: barCount }, (_, i) =>
      0.2 + 0.6 * Math.abs(Math.sin((i / barCount) * Math.PI * 3)),
    );
  }
}

function getFileIconPath(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  // Return an SVG path hint for specialised icons
  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'document';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'spreadsheet';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  if (['js', 'ts', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'json', 'xml', 'html', 'css', 'yaml', 'yml', 'toml', 'sh'].includes(ext)) return 'code';
  if (['txt', 'md', 'log'].includes(ext)) return 'text';
  return 'generic';
}

/* -------------------------------------------------------------------------
   Sub-components
   ------------------------------------------------------------------------- */

function FileIcon({ type }: { type: string }) {
  if (type === 'pdf') {
    return (
      <svg className="attachment-file-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M10 12h4" />
        <path d="M10 16h4" />
      </svg>
    );
  }
  if (type === 'archive') {
    return (
      <svg className="attachment-file-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8v13H3V8" />
        <path d="M1 3h22v5H1z" />
        <path d="M10 12h4" />
      </svg>
    );
  }
  if (type === 'code') {
    return (
      <svg className="attachment-file-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  }
  // Default file icon
  return (
    <svg className="attachment-file-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

/** Inline audio player with waveform visualisation. */
function AudioPlayer({ src, filename, size, durationSecs, waveform }: {
  src: string;
  filename: string;
  size: number;
  durationSecs?: number | null;
  waveform?: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSecs ?? 0);

  const BAR_COUNT = 48;
  const bars = waveform ? decodeWaveform(waveform, BAR_COUNT) : decodeWaveform('', BAR_COUNT);
  const progress = duration > 0 ? currentTime / duration : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => { /* user gesture required */ });
    }
  }, [playing]);

  const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }, [duration]);

  return (
    <div className="attachment-audio">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        className="attachment-audio-play"
        onClick={togglePlay}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6,4 20,12 6,20" />
          </svg>
        )}
      </button>
      <div className="attachment-audio-body">
        <div className="attachment-audio-waveform" onClick={handleWaveformClick} role="slider" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} tabIndex={0}>
          {bars.map((amp, i) => {
            const barProgress = i / BAR_COUNT;
            const isPlayed = barProgress <= progress;
            return (
              <div
                key={i}
                className={`attachment-audio-bar ${isPlayed ? 'attachment-audio-bar-played' : ''}`}
                style={{ height: `${Math.max(12, amp * 100)}%` }}
              />
            );
          })}
        </div>
        <div className="attachment-audio-meta">
          <span className="attachment-audio-time">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
          <span className="attachment-audio-info">
            {filename} &middot; {formatFileSize(size)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Inline video player with controls. */
function VideoPlayer({ src, filename }: {
  src: string;
  filename: string;
}) {
  return (
    <div className="attachment-video">
      <video
        src={src}
        className="attachment-video-player"
        controls
        preload="metadata"
        playsInline
      />
      <div className="attachment-video-filename">{filename}</div>
    </div>
  );
}

/** Download card for generic file attachments. */
function FileCard({ url, filename, size }: {
  url: string;
  filename: string;
  size: number;
}) {
  const iconType = getFileIconPath(filename);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="attachment-file-card"
      download={filename}
    >
      <div className="attachment-file-card-icon">
        <FileIcon type={iconType} />
      </div>
      <div className="attachment-file-card-info">
        <span className="attachment-file-card-name">{filename}</span>
        <span className="attachment-file-card-size">{formatFileSize(size)}</span>
      </div>
      <div className="attachment-file-card-download">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </div>
    </a>
  );
}

/* -------------------------------------------------------------------------
   Main component
   ------------------------------------------------------------------------- */

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
        const isAudio =
          mediaType.startsWith('audio/') || /\.(mp3|wav|flac|aac|ogg|m4a|opus|wma)$/i.test(fileName);

        /* ---------- Image ---------- */
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

        /* ---------- Video ---------- */
        if (isVideo) {
          return (
            <VideoPlayer
              key={att.id}
              src={resolvedUrl}
              filename={fileName}
            />
          );
        }

        /* ---------- Audio ---------- */
        if (isAudio) {
          return (
            <AudioPlayer
              key={att.id}
              src={resolvedUrl}
              filename={fileName}
              size={att.size}
              durationSecs={att.durationSecs}
              waveform={att.waveform}
            />
          );
        }

        /* ---------- Generic file ---------- */
        return (
          <FileCard
            key={att.id}
            url={resolvedUrl}
            filename={fileName}
            size={att.size}
          />
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
