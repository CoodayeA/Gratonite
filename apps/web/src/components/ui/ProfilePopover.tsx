import { useEffect, useMemo, useRef, useState } from 'react';
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
      className="profile-popover"
      ref={popoverRef}
      style={{
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
        className="profile-popover-banner"
        style={bannerHash ? { backgroundImage: `url(/api/v1/files/${bannerHash})` } : undefined}
      />
      {profileEffectHash && (
        <img
          className="profile-popover-effect"
          src={`/api/v1/files/${profileEffectHash}`}
          alt=""
          aria-hidden="true"
        />
      )}
      <div className="profile-popover-body">
        <Avatar
          name={displayName}
          hash={avatarHash}
          decorationHash={decorationHash}
          userId={userId}
          size={52}
          className="profile-popover-avatar"
        />
        <div className="profile-popover-names">
          <span className="profile-popover-name">
            <DisplayNameText
              text={displayName}
              userId={displayNameUserId ?? userId}
              guildId={guildId}
              context="profile"
            />
          </span>
          {username && <span className="profile-popover-username">@{username}</span>}
        </div>
        {avatarStudioPrefs?.enabled && (
          <div className="profile-popover-sprite-wrap">
            <AvatarSprite config={avatarStudioPrefs.sprite} size={58} className="profile-popover-sprite" />
          </div>
        )}
        {serverTagGuild && <div className="profile-popover-server-tag">{serverTagGuild.name}</div>}
        {statusText && <div className="profile-popover-status">{statusText}</div>}
        {enhancements && enhancements.widgets.length > 0 && (
          <div className="profile-popover-widgets">
            {enhancements.widgets.map((widget) => (
              <span key={widget} className="profile-popover-widget">{widget}</span>
            ))}
          </div>
        )}
        {bio && <p className="profile-popover-bio">{bio}</p>}
        {currentUserId && currentUserId !== userId && (
          <div className="profile-popover-actions">
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
