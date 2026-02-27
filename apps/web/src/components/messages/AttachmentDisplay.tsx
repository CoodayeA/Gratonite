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

const styles = {
  display: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  } as React.CSSProperties,
  imageLink: {
    display: 'block',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    maxWidth: 400,
    borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--stroke)',
    transition: 'border-color 0.15s',
    padding: 0,
    background: 'none',
    font: 'inherit',
    color: 'inherit',
    textAlign: 'inherit' as const,
    cursor: 'pointer',
  } as React.CSSProperties,
  imageLinkHover: {
    borderColor: 'var(--stroke-strong)',
  } as React.CSSProperties,
  image: {
    display: 'block',
    maxWidth: '100%',
    maxHeight: 300,
    objectFit: 'contain',
    borderRadius: 'var(--radius-md)',
  } as React.CSSProperties,
  video: {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 480,
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    border: '1px solid var(--stroke)',
    background: 'rgba(6, 10, 18, 0.5)',
  } as React.CSSProperties,
  videoPlayer: {
    display: 'block',
    width: '100%',
    maxHeight: 360,
    objectFit: 'contain',
    background: '#000',
  } as React.CSSProperties,
  videoFilename: {
    padding: '6px 12px',
    fontSize: 12,
    color: 'var(--text-faint)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,
  audio: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    background: 'rgba(6, 10, 18, 0.5)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    minWidth: 280,
    maxWidth: 420,
  } as React.CSSProperties,
  audioPlayBtn: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: 'var(--accent)',
    color: '#1a1a2e',
    cursor: 'pointer',
    transition: 'background 0.15s, transform 0.1s',
  } as React.CSSProperties,
  audioPlayBtnHover: {
    background: 'var(--accent-2)',
    transform: 'scale(1.06)',
  } as React.CSSProperties,
  audioBody: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } as React.CSSProperties,
  audioWaveform: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 2,
    height: 32,
    cursor: 'pointer',
    userSelect: 'none',
  } as React.CSSProperties,
  audioBar: {
    flex: 1,
    minWidth: 2,
    background: 'var(--stroke)',
    borderRadius: 1,
    transition: 'background 0.1s',
  } as React.CSSProperties,
  audioBarPlayed: {
    flex: 1,
    minWidth: 2,
    background: 'var(--accent)',
    borderRadius: 1,
    transition: 'background 0.1s',
  } as React.CSSProperties,
  audioMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  } as React.CSSProperties,
  audioTime: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,
  audioInfo: {
    fontSize: 11,
    color: 'var(--text-faint)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  } as React.CSSProperties,
  fileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    background: 'rgba(6, 10, 18, 0.5)',
    borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--stroke)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-muted)',
    textDecoration: 'none',
    transition: 'background 0.15s, border-color 0.15s',
    minWidth: 240,
    maxWidth: 360,
  } as React.CSSProperties,
  fileCardHover: {
    background: 'rgba(212, 175, 55, 0.04)',
    borderColor: 'var(--stroke-strong)',
    textDecoration: 'none',
    color: 'var(--text)',
  } as React.CSSProperties,
  fileCardIcon: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 'var(--radius-md)',
    background: 'rgba(212, 175, 55, 0.1)',
    color: 'var(--accent)',
  } as React.CSSProperties,
  fileIcon: {
    width: 24,
    height: 24,
  } as React.CSSProperties,
  fileCardInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  } as React.CSSProperties,
  fileCardName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--accent)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,
  fileCardSize: {
    fontSize: 11,
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  fileCardDownload: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-faint)',
    transition: 'color 0.15s, background 0.15s',
  } as React.CSSProperties,
  fileCardDownloadHover: {
    color: 'var(--accent)',
    background: 'rgba(212, 175, 55, 0.08)',
  } as React.CSSProperties,
};

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
    const bars: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const idx = Math.floor((i / barCount) * bytes.length);
      bars.push((bytes[idx] ?? 0) / maxVal);
    }
    return bars;
  } catch {
    return Array.from({ length: barCount }, (_, i) =>
      0.2 + 0.6 * Math.abs(Math.sin((i / barCount) * Math.PI * 3)),
    );
  }
}

function getFileIconPath(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
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
  const iconStyle = styles.fileIcon;
  if (type === 'pdf') {
    return (
      <svg style={iconStyle} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M10 12h4" />
        <path d="M10 16h4" />
      </svg>
    );
  }
  if (type === 'archive') {
    return (
      <svg style={iconStyle} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8v13H3V8" />
        <path d="M1 3h22v5H1z" />
        <path d="M10 12h4" />
      </svg>
    );
  }
  if (type === 'code') {
    return (
      <svg style={iconStyle} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  }
  return (
    <svg style={iconStyle} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
  const [playHovered, setPlayHovered] = useState(false);

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
    <div style={styles.audio}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        style={{ ...styles.audioPlayBtn, ...(playHovered ? styles.audioPlayBtnHover : {}) }}
        onClick={togglePlay}
        aria-label={playing ? 'Pause' : 'Play'}
        onMouseEnter={() => setPlayHovered(true)}
        onMouseLeave={() => setPlayHovered(false)}
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
      <div style={styles.audioBody}>
        <div style={styles.audioWaveform} onClick={handleWaveformClick} role="slider" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} tabIndex={0}>
          {bars.map((amp, i) => {
            const barProgress = i / BAR_COUNT;
            const isPlayed = barProgress <= progress;
            return (
              <div
                key={i}
                style={{
                  ...(isPlayed ? styles.audioBarPlayed : styles.audioBar),
                  height: `${Math.max(12, amp * 100)}%`,
                }}
              />
            );
          })}
        </div>
        <div style={styles.audioMeta}>
          <span style={styles.audioTime}>
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
          <span style={styles.audioInfo}>
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
    <div style={styles.video}>
      <video
        src={src}
        style={styles.videoPlayer}
        controls
        preload="metadata"
        playsInline
      />
      <div style={styles.videoFilename}>{filename}</div>
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
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ ...styles.fileCard, ...(hovered ? styles.fileCardHover : {}) }}
      download={filename}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.fileCardIcon}>
        <FileIcon type={iconType} />
      </div>
      <div style={styles.fileCardInfo}>
        <span style={styles.fileCardName}>{filename}</span>
        <span style={styles.fileCardSize}>{formatFileSize(size)}</span>
      </div>
      <div style={{ ...styles.fileCardDownload, ...(hovered ? styles.fileCardDownloadHover : {}) }}>
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

function ImageButton({ resolvedUrl, fileName, onClick }: {
  resolvedUrl: string;
  fileName: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      style={{ ...styles.imageLink, ...(hovered ? styles.imageLinkHover : {}) }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={resolvedUrl} alt={fileName} style={styles.image} loading="lazy" />
    </button>
  );
}

export function AttachmentDisplay({ attachments }: AttachmentDisplayProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string | undefined>(undefined);

  if (!attachments.length) return null;

  return (
    <div style={styles.display}>
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

        if (isImage) {
          return (
            <ImageButton
              key={att.id}
              resolvedUrl={resolvedUrl}
              fileName={fileName}
              onClick={() => {
                setLightboxSrc(resolvedUrl);
                setLightboxAlt(fileName);
              }}
            />
          );
        }

        if (isVideo) {
          return (
            <VideoPlayer
              key={att.id}
              src={resolvedUrl}
              filename={fileName}
            />
          );
        }

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
