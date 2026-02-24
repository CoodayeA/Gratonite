import { useGuildMembers } from '@/hooks/useGuildMembers';
import { useGuildsStore } from '@/stores/guilds.store';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { resolveProfile } from '@gratonite/profile-resolver';
import { useEffect, useMemo, useState } from 'react';
import { ProfilePopover } from '@/components/ui/ProfilePopover';
import { DisplayNameText } from '@/components/ui/DisplayNameText';
import { useAuthStore } from '@/stores/auth.store';
import { AvatarSprite } from '@/components/ui/AvatarSprite';
import { DEFAULT_AVATAR_STUDIO_PREFS, readAvatarStudioPrefs, subscribeAvatarStudioChanges } from '@/lib/avatarStudio';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePresenceStore } from '@/stores/presence.store';

export function MemberList() {
  const currentGuildId = useGuildsStore((s) => s.currentGuildId);
  const { data: members, isLoading } = useGuildMembers(currentGuildId ?? undefined);
  const [popover, setPopover] = useState<{ x: number; y: number; member: any } | null>(null);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const [avatarStudioPrefs, setAvatarStudioPrefs] = useState(DEFAULT_AVATAR_STUDIO_PREFS);
  const presenceMap = usePresenceStore((s) => s.byUserId);

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
      <aside className="member-list">
        <div className="member-list-loading">
          <LoadingSpinner size={24} />
        </div>
      </aside>
    );
  }

  return (
    <aside className="member-list">
      <h3 className="member-list-header">
        Members &mdash; {members?.length ?? 0}
      </h3>
      <div className="member-list-items">
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

          return (
            <div
              key={userId}
              className="member-list-item"
              onClick={(e) => setPopover({ x: e.clientX, y: e.clientY, member })}
              role="button"
              tabIndex={0}
            >
              {avatarStudioPrefs.enabled && currentUserId && currentUserId === userId ? (
                <span className="avatar-status-wrap">
                  <AvatarSprite config={avatarStudioPrefs.sprite} size={34} className="member-list-sprite" />
                  {presenceStatus !== 'offline' && <span className={`avatar-presence-badge presence-${presenceStatus}`} />}
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
              <div className="member-list-info">
                <span className="member-list-name">
                  <DisplayNameText
                    text={resolved.displayName}
                    userId={userId}
                    guildId={currentGuildId}
                    context="server"
                  />
                </span>
                {member.user?.username && (
                  <span className="member-list-username">@{member.user.username}</span>
                )}
                <span className={`member-list-presence member-list-presence-${presenceStatus}`}>
                  <span className={`presence-dot presence-${presenceStatus}`} />
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
