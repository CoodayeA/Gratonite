import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../../lib/api';
import { getDeterministicGradient } from '../../utils/colors';
import { useUser } from '../../contexts/UserContext';

export interface AvatarProps {
  userId: string;
  avatarHash?: string | null;
  avatarAnimated?: boolean;
  displayName?: string;
  size?: number;
  frame?: 'none' | 'neon' | 'gold' | 'glass' | 'rainbow' | 'pulse';
  /** Optional presence status dot */
  status?: 'online' | 'idle' | 'dnd' | 'invisible' | 'offline' | null;
  /** Background color behind the status dot (matches parent bg) */
  statusRingColor?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}

const STATUS_DOT_COLORS: Record<string, string> = {
  online: '#43b581',
  idle: '#faa61a',
  dnd: '#f04747',
  invisible: '#747f8d',
  offline: '#747f8d',
};

const STATUS_SYMBOLS: Record<string, string> = {
  online: '\u2713',   // checkmark
  idle: '\u25D0',     // half circle
  dnd: '\u2298',      // circled division slash
  invisible: '\u25CB', // white circle
  offline: '\u25CB',   // white circle
};

const DECORATION_EMOJI: Record<string, string> = {
  crown:  '\u{1F451}',
  star:   '\u2B50',
  flame:  '\u{1F525}',
  bolt:   '\u26A1',
  orb:    '\u{1F52E}',
  shield: '\u{1F6E1}\uFE0F',
  gem:    '\u{1F48E}',
  lotus:  '\u{1F338}',
  moon:   '\u{1F319}',
};

const DECORATION_POSITIONS: Record<string, React.CSSProperties> = {
  'top-right':    { top: -4, right: -4 },
  'top-left':     { top: -4, left:  -4 },
  'bottom-right': { bottom: -4, right: -4 },
  'bottom-left':  { bottom: -4, left:  -4 },
};

type FrameType = 'none' | 'neon' | 'gold' | 'glass' | 'rainbow' | 'pulse';

const Avatar = ({
  userId,
  avatarHash,
  avatarAnimated,
  displayName,
  size = 32,
  frame,
  status = null,
  statusRingColor = 'var(--bg-secondary)',
  style,
  onClick,
}: AvatarProps) => {
  const { user } = useUser();
  const [imgError, setImgError] = useState(false);
  const [didRetry, setDidRetry] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const label = displayName || userId.slice(0, 8);
  const letter = label.charAt(0).toUpperCase();
  const gradient = getDeterministicGradient(label);
  const showImg = avatarHash && !imgError;
  const statusDotSize = Math.max(8, Math.round(size * 0.3));
  const statusRingSize = statusDotSize + 4;
  const isCurrentUserAvatar = userId === 'me' || (!!user.id && userId === user.id);

  const readStoredFrame = (): FrameType => {
    try {
      const key = user.id ? `gratonite-avatar-frame:${user.id}` : 'gratonite-avatar-frame';
      const value = localStorage.getItem(key) || localStorage.getItem('gratonite-avatar-frame');
      if (value === 'neon' || value === 'gold' || value === 'glass' || value === 'rainbow' || value === 'pulse' || value === 'none') return value;
    } catch { /* ignore */ }
    return 'none';
  };

  const readStoredGlowColor = (): string | undefined => {
    try {
      const key = user.id ? `gratonite-avatar-frame-color:${user.id}` : 'gratonite-avatar-frame-color';
      return localStorage.getItem(key) || localStorage.getItem('gratonite-avatar-frame-color') || undefined;
    } catch { /* ignore */ }
    return undefined;
  };

  const readStoredDecoration = (): { shape: string; position: string } | null => {
    try {
      const key = user.id ? `gratonite-decoration:${user.id}` : 'gratonite-decoration';
      const raw = localStorage.getItem(key) || localStorage.getItem('gratonite-decoration');
      return raw ? JSON.parse(raw) as { shape: string; position: string } : null;
    } catch { return null; }
  };

  const [frameState, setFrameState] = useState<{ frame: FrameType; glowColor?: string }>(() => ({
    frame: isCurrentUserAvatar ? readStoredFrame() : 'none',
    glowColor: isCurrentUserAvatar ? readStoredGlowColor() : undefined,
  }));

  const [decoration, setDecoration] = useState<{ shape: string; position: string } | null>(
    () => isCurrentUserAvatar ? readStoredDecoration() : null
  );

  useEffect(() => {
    setImgError(false);
    setDidRetry(false);
    setRetryNonce(0);
  }, [avatarHash, userId]);

  useEffect(() => {
    if (!isCurrentUserAvatar) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      const f = detail.frame as string;
      const validFrame: FrameType =
        (f === 'neon' || f === 'gold' || f === 'glass' || f === 'rainbow' || f === 'pulse' || f === 'none') ? f : 'none';
      setFrameState({ frame: validFrame, glowColor: detail.glowColor as string | undefined });
    };
    window.addEventListener('gratonite:avatar-frame-updated', handler);
    return () => window.removeEventListener('gratonite:avatar-frame-updated', handler);
  }, [isCurrentUserAvatar]);

  useEffect(() => {
    if (!isCurrentUserAvatar) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setDecoration(detail ?? null);
    };
    window.addEventListener('gratonite:decoration-updated', handler);
    return () => window.removeEventListener('gratonite:decoration-updated', handler);
  }, [isCurrentUserAvatar]);

  const fallbackFrame = useMemo<FrameType>(() => {
    if (!isCurrentUserAvatar) return 'none';
    return frameState.frame;
  }, [isCurrentUserAvatar, frameState.frame]);

  const resolvedFrame = frame ?? fallbackFrame;
  const resolvedGlowColor = frameState.glowColor ?? 'rgba(56, 189, 248, 0.6)';

  const frameClassName =
    resolvedFrame === 'rainbow' ? 'avatar-frame-rainbow' :
    resolvedFrame === 'pulse'   ? 'avatar-frame-pulse'   :
    undefined;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        position: 'relative',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {/* Inner circle — overflow:hidden here clips the image without clipping the status dot */}
      <div
        className={frameClassName}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: showImg ? 'var(--bg-tertiary)' : gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: Math.round(size * 0.4),
          fontWeight: 600,
          overflow: 'hidden',
          boxShadow:
            resolvedFrame === 'neon'
              ? `0 0 14px ${resolvedGlowColor}`
              : resolvedFrame === 'gold'
                ? '0 0 0 2px #f59e0b, 0 0 10px rgba(245, 158, 11, 0.5)'
                : resolvedFrame === 'pulse'
                  ? `0 0 0 2px ${resolvedGlowColor}, 0 0 20px ${resolvedGlowColor}`
                  : undefined,
          border:
            resolvedFrame === 'glass'
              ? '1px solid rgba(255,255,255,0.35)'
              : resolvedFrame === 'rainbow'
                ? '2px solid transparent'
                : undefined,
          backdropFilter:
            resolvedFrame === 'glass'
              ? 'blur(6px)'
              : undefined,
          ['--glow-color' as string]: resolvedGlowColor,
        }}
      >
        {showImg ? (
          <img
            src={(() => {
              const isAnimated = avatarAnimated || (avatarHash?.includes('.gif'));
              const staticSuffix = isAnimated && !isHovered ? '_static' : '';
              return `${API_BASE}/files/${avatarHash}${staticSuffix}${retryNonce ? `?r=${retryNonce}` : ''}`;
            })()}
            alt={label}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '50%',
            }}
            onError={() => {
              if (imgError) return;
              if (!didRetry) {
                setDidRetry(true);
                setRetryNonce(Date.now());
                return;
              }
              setImgError(true);
            }}
          />
        ) : (
          letter
        )}
      </div>

      {/* Status dot — rendered outside the overflow:hidden inner circle */}
      {status && (
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: statusRingSize,
            height: statusRingSize,
            background: statusRingColor,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label={`Status: ${status}`}
        >
          <div
            className="status-dot-inner"
            style={{
              width: statusDotSize,
              height: statusDotSize,
              borderRadius: '50%',
              background: STATUS_DOT_COLORS[status] || STATUS_DOT_COLORS.offline,
              transition: 'background-color 300ms ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: Math.max(6, statusDotSize - 3),
              lineHeight: 1,
              color: '#fff',
              fontWeight: 700,
            }}
            data-status-symbol={STATUS_SYMBOLS[status] || ''}
          />
        </div>
      )}

      {/* Decoration badge */}
      {decoration && (() => {
        const emoji = DECORATION_EMOJI[decoration.shape] ?? '\u2728';
        const pos = DECORATION_POSITIONS[decoration.position] ?? DECORATION_POSITIONS['top-right'];
        const badgeSize = Math.max(12, Math.round(size * 0.38));
        return (
          <div style={{
            position: 'absolute',
            ...pos,
            fontSize: badgeSize,
            lineHeight: 1,
            pointerEvents: 'none',
            userSelect: 'none',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
          }}>
            {emoji}
          </div>
        );
      })()}
    </div>
  );
};

export default Avatar;
