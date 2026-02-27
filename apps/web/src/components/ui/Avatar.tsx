import React from 'react';
import type { HTMLAttributes } from 'react';
import { getInitials } from '@/lib/utils';
import type { PresenceStatus } from '@/stores/presence.store';

/* ── CSS variable design tokens ─────────────────────────────────────── */
const V = {
  text: 'var(--text, #e8e4e0)',
  gradientPrimary: 'var(--gradient-primary, linear-gradient(135deg, #d4af37, #c4a035))',
} as const;

/* ── Inline style objects ───────────────────────────────────────────── */

const avatarBase = {
  borderRadius: '50%',
  overflow: 'hidden',
  flexShrink: 0,
  objectFit: 'cover',
} as React.CSSProperties;

const avatarFallbackBase = {
  ...avatarBase,
  display: 'grid',
  placeItems: 'center',
  background: V.gradientPrimary,
  border: '1px solid rgba(212, 175, 55, 0.2)',
  fontWeight: 600,
  color: V.text,
} as React.CSSProperties;

const avatarDecoratedStyle = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
} as React.CSSProperties;

const avatarInDecoratedStyle = {
  width: '100%',
  height: '100%',
} as React.CSSProperties;

const avatarDecorationOverlayStyle = {
  position: 'absolute',
  inset: '-12%',
  width: '124%',
  height: '124%',
  objectFit: 'contain',
  pointerEvents: 'none',
} as React.CSSProperties;

const avatarStatusWrapStyle = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
} as React.CSSProperties;

const avatarPresenceBadgeBase = {
  position: 'absolute',
  right: -1,
  bottom: -1,
  width: 11,
  height: 11,
  borderRadius: 'var(--radius-pill)',
  border: '2px solid rgba(8, 12, 20, 0.95)',
  boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.06)',
} as React.CSSProperties;

const presenceColors: Record<string, string> = {
  online: '#22c55e',
  idle: '#f59e0b',
  dnd: '#ef4444',
  invisible: '#64748b',
  offline: '#64748b',
};

interface AvatarProps extends HTMLAttributes<HTMLElement> {
  name: string;
  hash?: string | null;
  decorationHash?: string | null;
  /** Full URL override for decoration (cosmetics system) — takes priority over decorationHash */
  decorationUrl?: string | null;
  userId?: string;
  size?: number;
  className?: string;
  presenceStatus?: PresenceStatus;
}

export function Avatar({
  name,
  hash,
  decorationHash,
  decorationUrl,
  userId,
  size = 36,
  className = '',
  presenceStatus,
  style: externalStyle,
  ...props
}: AvatarProps) {
  // Resolve decoration source: full URL takes priority over hash
  const resolvedDecorationSrc = decorationUrl ?? (decorationHash ? `/api/v1/files/${decorationHash}` : null);
  const sizeStyle = { width: size, height: size, fontSize: size * 0.4 };

  const presenceBadge = presenceStatus && presenceStatus !== 'offline' ? (
    <span
      style={{
        ...avatarPresenceBadgeBase,
        background: presenceColors[presenceStatus] ?? presenceColors['offline'],
      }}
      aria-hidden="true"
    />
  ) : null;

  const avatarContent = hash && userId ? (
    <img
      style={resolvedDecorationSrc
        ? { ...avatarBase, ...avatarInDecoratedStyle }
        : { ...avatarBase, ...sizeStyle, ...externalStyle }
      }
      src={`/api/v1/files/${hash}`}
      alt={name}
      {...(resolvedDecorationSrc ? {} : props)}
    />
  ) : (
    <div
      style={resolvedDecorationSrc
        ? { ...avatarFallbackBase, ...avatarInDecoratedStyle }
        : { ...avatarFallbackBase, ...sizeStyle, ...externalStyle }
      }
      {...(resolvedDecorationSrc ? {} : props)}
    >
      {getInitials(name, 1)}
    </div>
  );

  if (resolvedDecorationSrc) {
    return (
      <span
        style={{ ...avatarDecoratedStyle, ...sizeStyle, ...externalStyle }}
        {...props}
      >
        {avatarContent}
        <img
          src={resolvedDecorationSrc}
          alt=""
          style={avatarDecorationOverlayStyle}
          aria-hidden="true"
        />
        {presenceBadge}
      </span>
    );
  }
  if (presenceStatus && presenceStatus !== 'offline') {
    return (
      <span style={{ ...avatarStatusWrapStyle, ...sizeStyle }}>
        {avatarContent}
        {presenceBadge}
      </span>
    );
  }
  return avatarContent;
}
