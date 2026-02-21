import { useGuildMembers } from '@/hooks/useGuildMembers';
import { useGuildsStore } from '@/stores/guilds.store';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { resolveProfile } from '@gratonite/profile-resolver';
import { useState } from 'react';
import { ProfilePopover } from '@/components/ui/ProfilePopover';

export function MemberList() {
  const currentGuildId = useGuildsStore((s) => s.currentGuildId);
  const { data: members, isLoading } = useGuildMembers(currentGuildId ?? undefined);
  const [popover, setPopover] = useState<{ x: number; y: number; member: any } | null>(null);

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

          return (
            <div
              key={userId}
              className="member-list-item"
              onClick={(e) => setPopover({ x: e.clientX, y: e.clientY, member })}
              role="button"
              tabIndex={0}
            >
              <Avatar name={resolved.displayName} hash={resolved.avatarHash} userId={userId} size={32} />
              <div className="member-list-info">
                <span className="member-list-name">{resolved.displayName}</span>
                {member.user?.username && (
                  <span className="member-list-username">@{member.user.username}</span>
                )}
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
            username={popover.member.user.username ?? null}
            avatarHash={resolved.avatarHash}
            bannerHash={resolved.bannerHash}
            bio={resolved.bio}
            userId={popover.member.user.id}
            onClose={() => setPopover(null)}
          />
        );
      })()}
    </aside>
  );
}
