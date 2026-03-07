import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../../lib/api';
import { getDeterministicGradient } from '../../utils/colors';
import { useUser } from '../../contexts/UserContext';

export interface AvatarProps {
  userId: string;
  avatarHash?: string | null;
  displayName?: string;
  size?: number;
  frame?: 'none' | 'neon' | 'gold' | 'glass';
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

const Avatar = ({
  userId,
  avatarHash,
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
  const label = displayName || userId.slice(0, 8);
  const letter = label.charAt(0).toUpperCase();
  const gradient = getDeterministicGradient(label);
  const showImg = avatarHash && !imgError;
  const statusDotSize = Math.max(8, Math.round(size * 0.3));
  const statusRingSize = statusDotSize + 4;
  const isCurrentUserAvatar = userId === 'me' || (!!user.id && userId === user.id);

  const readStoredFrame = (): 'none' | 'neon' | 'gold' | 'glass' => {
    try {
      const key = user.id ? `gratonite-avatar-frame:${user.id}` : 'gratonite-avatar-frame';
      const value = localStorage.getItem(key) || localStorage.getItem('gratonite-avatar-frame');
      if (value === 'neon' || value === 'gold' || value === 'glass' || value === 'none') return value;
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

  const [frameState, setFrameState] = useState<{ frame: 'none' | 'neon' | 'gold' | 'glass'; glowColor?: string }>(() => ({
    frame: isCurrentUserAvatar ? readStoredFrame() : 'none',
    glowColor: isCurrentUserAvatar ? readStoredGlowColor() : undefined,
  }));

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
      const validFrame = (f === 'neon' || f === 'gold' || f === 'glass' || f === 'none') ? f : 'none';
      setFrameState({ frame: validFrame, glowColor: detail.glowColor as string | undefined });
    };
    window.addEventListener('gratonite:avatar-frame-updated', handler);
    return () => window.removeEventListener('gratonite:avatar-frame-updated', handler);
  }, [isCurrentUserAvatar]);

  const fallbackFrame = useMemo<'none' | 'neon' | 'gold' | 'glass'>(() => {
    if (!isCurrentUserAvatar) return 'none';
    return frameState.frame;
  }, [isCurrentUserAvatar, frameState.frame]);

  const resolvedFrame = frame ?? fallbackFrame;
  const resolvedGlowColor = frameState.glowColor ?? 'rgba(56, 189, 248, 0.6)';

  return (
    <div
      onClick={onClick}
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
                : undefined,
          border:
            resolvedFrame === 'glass'
              ? '1px solid rgba(255,255,255,0.35)'
              : undefined,
          backdropFilter:
            resolvedFrame === 'glass'
              ? 'blur(6px)'
              : undefined,
        }}
      >
        {showImg ? (
          <img
            src={`${API_BASE}/files/${avatarHash}${retryNonce ? `?r=${retryNonce}` : ''}`}
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
        >
          <div
            style={{
              width: statusDotSize,
              height: statusDotSize,
              borderRadius: '50%',
              background: STATUS_DOT_COLORS[status] || STATUS_DOT_COLORS.offline,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Avatar;
