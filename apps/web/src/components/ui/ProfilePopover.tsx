import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar } from './Avatar';
import { DisplayNameText } from './DisplayNameText';
import { useAuthStore } from '@/stores/auth.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { getActiveStatusText, readProfileEnhancementsPrefs } from '@/lib/profileEnhancements';
import { getAvatarDecorationById, getProfileEffectById } from '@/lib/profileCosmetics';
import { readAvatarStudioPrefs } from '@/lib/avatarStudio';
import { AvatarSprite } from './AvatarSprite';
import { api } from '@/lib/api';
import { Button } from './Button';

/* ── CSS variable design tokens ─────────────────────────────────────── */
const V = {
  bgFloat: 'var(--bg-float, #2c2c3e)',
  stroke: 'var(--stroke, #4a4660)',
  text: 'var(--text, #e8e4e0)',
  textMuted: 'var(--text-muted, #a8a4b8)',
  textFaint: 'var(--text-faint, #6e6a80)',
  radiusLg: 'var(--radius-lg, 12px)',
} as const;

/* ── Inline style objects ───────────────────────────────────────────── */

const popoverBase = {
  position: 'fixed',
  zIndex: 210,
  width: 280,
  background: V.bgFloat,
  border: `1px solid ${V.stroke}`,
  borderRadius: V.radiusLg,
  overflow: 'hidden',
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
} as React.CSSProperties;

const effectStyle = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  opacity: 0.42,
  pointerEvents: 'none',
  zIndex: 0,
} as React.CSSProperties;

const bannerBase = {
  height: 84,
  background: 'linear-gradient(120deg, rgba(212, 175, 55, 0.2), rgba(255, 145, 86, 0.12))',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
} as React.CSSProperties;

const bodyStyle = {
  padding: '14px 16px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginTop: -26,
  position: 'relative',
  zIndex: 1,
} as React.CSSProperties;

const avatarStyle = {
  border: '2px solid rgba(10, 14, 22, 0.9)',
} as React.CSSProperties;

const namesStyle = {
  display: 'flex',
  flexDirection: 'column',
} as React.CSSProperties;

const nameStyle = {
  fontSize: 15,
  fontWeight: 700,
  color: V.text,
} as React.CSSProperties;

const usernameStyle = {
  fontSize: 12,
  color: V.textFaint,
} as React.CSSProperties;

const bioStyle = {
  fontSize: 12,
  color: V.textMuted,
  margin: 0,
} as React.CSSProperties;

const spriteWrapStyle = {
  display: 'flex',
  justifyContent: 'flex-start',
} as React.CSSProperties;

const spriteStyle = {
  borderRadius: 'var(--radius-lg)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  background: 'rgba(8, 12, 20, 0.42)',
} as React.CSSProperties;

const serverTagStyle = {
  alignSelf: 'flex-start',
  fontSize: 10,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: V.text,
  border: '1px solid rgba(212, 175, 55, 0.35)',
  background: 'rgba(212, 175, 55, 0.12)',
  borderRadius: 'var(--radius-pill)',
  padding: '3px 8px',
} as React.CSSProperties;

const statusStyle = {
  fontSize: 12,
  color: V.textMuted,
  borderLeft: '2px solid rgba(212, 175, 55, 0.4)',
  paddingLeft: 8,
} as React.CSSProperties;

const widgetsStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
} as React.CSSProperties;

const widgetStyle = {
  fontSize: 10,
  color: V.textFaint,
  border: `1px solid ${V.stroke}`,
  borderRadius: 'var(--radius-pill)',
  padding: '3px 8px',
  background: 'rgba(6, 10, 20, 0.48)',
} as React.CSSProperties;

const actionsStyle = {
  display: 'flex',
  gap: 8,
  marginTop: 4,
} as React.CSSProperties;

interface ProfilePopoverProps {
  x: number;
  y: number;
  displayName: string;
  displayNameUserId?: string | null;
  guildId?: string | null;
  username: string | null;
  avatarHash: string | null;
  bannerHash: string | null;
  bio?: string | null;
  userId: string;
  primaryColor?: number | null;
  accentColor?: number | null;
  onClose: () => void;
}

export function ProfilePopover({
  x,
  y,
  displayName,
  displayNameUserId,
  guildId,
  username,
  avatarHash,
  bannerHash,
  bio,
  userId,
  primaryColor,
  accentColor,
  onClose,
}: ProfilePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const currentUser = useAuthStore((s) => s.user);
  const guilds = useGuildsStore((s) => s.guilds);
  const enhancements =
    currentUserId && currentUserId === (displayNameUserId ?? userId)
      ? readProfileEnhancementsPrefs(currentUserId)
      : null;
  const statusText = enhancements ? getActiveStatusText(enhancements) : '';
  const serverTagGuild =
    enhancements?.serverTagGuildId ? guilds.get(enhancements.serverTagGuildId) : null;
  const decorationHash =
    currentUserId && currentUserId === userId
      ? getAvatarDecorationById(currentUser?.avatarDecorationId)?.assetHash ?? null
      : null;
  const profileEffectHash =
    currentUserId && currentUserId === userId
      ? getProfileEffectById(currentUser?.profileEffectId)?.assetHash ?? null
      : null;
  const avatarStudioPrefs =
    currentUserId && currentUserId === userId ? readAvatarStudioPrefs(userId) : null;
  const queryClient = useQueryClient();
  const [blockingBusy, setBlockingBusy] = useState(false);
  const { data: relationships = [] } = useQuery({
    queryKey: ['relationships'],
    queryFn: () => api.relationships.getAll() as Promise<Array<{ targetId: string; type: string }>>,
    staleTime: 15_000,
  });
  const isBlocked = useMemo(
    () => relationships.some((rel) => rel.type === 'blocked' && rel.targetId === userId),
    [relationships, userId],
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      popoverRef.current.style.left = `${window.innerWidth - rect.width - 12}px`;
    }
    if (rect.bottom > window.innerHeight) {
      popoverRef.current.style.top = `${window.innerHeight - rect.height - 12}px`;
    }
  }, [x, y]);

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        ...popoverBase,
        top: y,
        left: x,
        '--profile-primary': primaryColor != null
          ? `#${primaryColor.toString(16).padStart(6, '0')}`
          : undefined,
        '--profile-accent': accentColor != null
          ? `#${accentColor.toString(16).padStart(6, '0')}`
          : undefined,
      } as React.CSSProperties}
    >
      <div
        style={bannerHash ? { ...bannerBase, backgroundImage: `url(/api/v1/files/${bannerHash})` } : bannerBase}
      />
      {profileEffectHash && (
        <img
          style={effectStyle}
          src={`/api/v1/files/${profileEffectHash}`}
          alt=""
          aria-hidden="true"
        />
      )}
      <div style={bodyStyle}>
        <Avatar
          name={displayName}
          hash={avatarHash}
          decorationHash={decorationHash}
          userId={userId}
          size={52}
          style={avatarStyle}
        />
        <div style={namesStyle}>
          <span style={nameStyle}>
            <DisplayNameText
              text={displayName}
              userId={displayNameUserId ?? userId}
              guildId={guildId}
              context="profile"
            />
          </span>
          {username && <span style={usernameStyle}>@{username}</span>}
        </div>
        {avatarStudioPrefs?.enabled && (
          <div style={spriteWrapStyle}>
            <AvatarSprite config={avatarStudioPrefs.sprite} size={58} style={spriteStyle} />
          </div>
        )}
        {serverTagGuild && <div style={serverTagStyle}>{serverTagGuild.name}</div>}
        {statusText && <div style={statusStyle}>{statusText}</div>}
        {enhancements && enhancements.widgets.length > 0 && (
          <div style={widgetsStyle}>
            {enhancements.widgets.map((widget) => (
              <span key={widget} style={widgetStyle}>{widget}</span>
            ))}
          </div>
        )}
        {bio && <p style={bioStyle}>{bio}</p>}
        {currentUserId && currentUserId !== userId && (
          <div style={actionsStyle}>
            <Button
              size="sm"
              variant={isBlocked ? 'ghost' : 'danger'}
              loading={blockingBusy}
              onClick={async () => {
                setBlockingBusy(true);
                try {
                  if (isBlocked) {
                    await api.relationships.unblock(userId);
                  } else {
                    await api.relationships.block(userId);
                  }
                  queryClient.invalidateQueries({ queryKey: ['relationships'] });
                  queryClient.invalidateQueries({ queryKey: ['relationships', 'dms'] });
                } finally {
                  setBlockingBusy(false);
                }
              }}
            >
              {isBlocked ? 'Unblock User' : 'Block User'}
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
