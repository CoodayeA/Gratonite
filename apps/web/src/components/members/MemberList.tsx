import React, { useEffect, useMemo, useState } from 'react';
import { useGuildMembers } from '@/hooks/useGuildMembers';
import { useGuildsStore } from '@/stores/guilds.store';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { resolveProfile } from '@gratonite/profile-resolver';
import { ProfilePopover } from '@/components/ui/ProfilePopover';
import { DisplayNameText } from '@/components/ui/DisplayNameText';
import { useAuthStore } from '@/stores/auth.store';
import { AvatarSprite } from '@/components/ui/AvatarSprite';
import { DEFAULT_AVATAR_STUDIO_PREFS, readAvatarStudioPrefs, subscribeAvatarStudioChanges } from '@/lib/avatarStudio';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePresenceStore } from '@/stores/presence.store';

const PRESENCE_COLORS: Record<string, string> = {
  online: '#23a55a',
  idle: '#f0b232',
  dnd: '#f23f43',
  offline: '#80848e',
};

const styles = {
  aside: {
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(11, 17, 28, 0.95)',
    borderLeft: '1px solid var(--stroke, #4a4660)',
    overflow: 'hidden',
  } as React.CSSProperties,
  header: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-faint, #6e6a80)',
    padding: '16px 16px 8px',
    flexShrink: 0,
  } as React.CSSProperties,
  items: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 8px 8px',
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--stroke, #4a4660) transparent',
  } as React.CSSProperties,
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 8px',
    borderRadius: 'var(--radius-sm, 4px)',
    transition: 'background 0.1s ease',
    cursor: 'pointer',
  } as React.CSSProperties,
  itemHover: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 8px',
    borderRadius: 'var(--radius-sm, 4px)',
    transition: 'background 0.1s ease',
    cursor: 'pointer',
    background: 'rgba(212, 175, 55, 0.04)',
  } as React.CSSProperties,
  avatarStatusWrap: {
    position: 'relative',
    display: 'inline-flex',
  } as React.CSSProperties,
  presenceBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: '50%',
    border: '2px solid rgba(11, 17, 28, 0.95)',
  } as React.CSSProperties,
  info: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  } as React.CSSProperties,
  name: {
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,
  username: {
    fontSize: 11,
    color: 'var(--text-faint, #6e6a80)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,
  presence: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10,
    color: 'var(--text-faint, #6e6a80)',
    marginTop: 2,
  } as React.CSSProperties,
  presenceDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  } as React.CSSProperties,
  loading: {
    display: 'grid',
    placeItems: 'center',
    flex: 1,
    padding: 40,
  } as React.CSSProperties,
} as const;

export function MemberList() {
  const currentGuildId = useGuildsStore((s) => s.currentGuildId);
  const { data: members, isLoading } = useGuildMembers(currentGuildId ?? undefined);
  const [popover, setPopover] = useState<{ x: number; y: number; member: any } | null>(null);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const [avatarStudioPrefs, setAvatarStudioPrefs] = useState(DEFAULT_AVATAR_STUDIO_PREFS);
  const presenceMap = usePresenceStore((s) => s.byUserId);
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);

  const memberUserIds = useMemo(
    () => (members ?? []).map((member: any) => String(member.userId ?? member.user?.id ?? '')).filter(Boolean),
    [members],
  );

  useQuery({
    queryKey: ['users', 'presences', memberUserIds],
    queryFn: async () => {
      const rows = await api.users.getPresences(memberUserIds);
      usePresenceStore.getState().setMany(rows.map((row) => ({
        userId: row.userId,
        status: row.status === 'invisible' ? 'offline' : row.status,
        lastSeen: row.lastSeen,
      })));
      return rows;
    },
    enabled: memberUserIds.length > 0,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!currentUserId) {
      setAvatarStudioPrefs(DEFAULT_AVATAR_STUDIO_PREFS);
      return;
    }
    setAvatarStudioPrefs(readAvatarStudioPrefs(currentUserId));
    return subscribeAvatarStudioChanges((changedUserId) => {
      if (changedUserId !== currentUserId) return;
      setAvatarStudioPrefs(readAvatarStudioPrefs(currentUserId));
    });
  }, [currentUserId]);

  if (isLoading) {
    return (
      <aside style={styles.aside}>
        <div style={styles.loading}>
          <LoadingSpinner size={24} />
        </div>
      </aside>
    );
  }

  return (
    <aside style={styles.aside}>
      <h3 style={styles.header}>
        Members &mdash; {members?.length ?? 0}
      </h3>
      <div style={styles.items}>
        {members?.map((member: any) => {
          const resolved = resolveProfile(
            {
              displayName: member.user?.displayName,
              username: member.user?.username,
              avatarHash: member.user?.avatarHash ?? null,
            },
            {
              nickname: member.profile?.nickname ?? member.nickname,
              avatarHash: member.profile?.avatarHash ?? null,
              bannerHash: member.profile?.bannerHash ?? null,
              bio: member.profile?.bio ?? null,
            },
          );
          const userId = member.userId ?? member.user?.id;
          const presenceStatus = (userId ? presenceMap.get(String(userId))?.status : undefined) ?? 'offline';
          const presenceColor = PRESENCE_COLORS[presenceStatus] ?? PRESENCE_COLORS.offline;

          return (
            <div
              key={userId}
              style={hoveredUserId === userId ? styles.itemHover : styles.item}
              onClick={(e) => setPopover({ x: e.clientX, y: e.clientY, member })}
              onMouseEnter={() => setHoveredUserId(userId)}
              onMouseLeave={() => setHoveredUserId(null)}
              role="button"
              tabIndex={0}
            >
              {avatarStudioPrefs.enabled && currentUserId && currentUserId === userId ? (
                <span style={styles.avatarStatusWrap}>
                  <AvatarSprite config={avatarStudioPrefs.sprite} size={34} />
                  {presenceStatus !== 'offline' && (
                    <span style={{ ...styles.presenceBadge, background: presenceColor }} />
                  )}
                </span>
              ) : (
                <Avatar
                  name={resolved.displayName}
                  hash={resolved.avatarHash}
                  userId={userId}
                  size={32}
                  presenceStatus={presenceStatus}
                />
              )}
              <div style={styles.info}>
                <span style={styles.name}>
                  <DisplayNameText
                    text={resolved.displayName}
                    userId={userId}
                    guildId={currentGuildId}
                    context="server"
                  />
                </span>
                {member.user?.username && (
                  <span style={styles.username}>@{member.user.username}</span>
                )}
                <span style={styles.presence}>
                  <span style={{ ...styles.presenceDot, background: presenceColor }} />
                  {presenceStatus === 'idle' ? 'Away' : presenceStatus === 'dnd' ? 'Do Not Disturb' : presenceStatus === 'offline' ? 'Offline' : 'Online'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {popover?.member?.user && (() => {
        const resolved = resolveProfile(
          {
            displayName: popover.member.user.displayName,
            username: popover.member.user.username,
            avatarHash: popover.member.user.avatarHash ?? null,
            primaryColor: (popover.member.user as any).primaryColor ?? null,
            accentColor: (popover.member.user as any).accentColor ?? null,
          },
          {
            nickname: popover.member.profile?.nickname ?? popover.member.nickname,
            avatarHash: popover.member.profile?.avatarHash ?? null,
            bannerHash: popover.member.profile?.bannerHash ?? null,
            bio: popover.member.profile?.bio ?? null,
          },
        );

        return (
          <ProfilePopover
            x={popover.x}
            y={popover.y}
            displayName={resolved.displayName}
            displayNameUserId={popover.member.user.id}
            guildId={currentGuildId}
            username={popover.member.user.username ?? null}
            avatarHash={resolved.avatarHash}
            bannerHash={resolved.bannerHash}
            bio={resolved.bio}
            userId={popover.member.user.id}
            primaryColor={resolved.primaryColor}
            accentColor={resolved.accentColor}
            onClose={() => setPopover(null)}
          />
        );
      })()}
    </aside>
  );
}
