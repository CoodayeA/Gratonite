import { useGuildMembers } from '@/hooks/useGuildMembers';
import { useGuildsStore } from '@/stores/guilds.store';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function MemberList() {
  const currentGuildId = useGuildsStore((s) => s.currentGuildId);
  const { data: members, isLoading } = useGuildMembers(currentGuildId ?? undefined);

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
          const displayName = member.user?.displayName ?? member.nickname ?? 'Unknown';
          const avatarHash = member.user?.avatarHash ?? null;
          const userId = member.userId ?? member.user?.id;

          return (
            <div key={userId} className="member-list-item">
              <Avatar name={displayName} hash={avatarHash} userId={userId} size={32} />
              <div className="member-list-info">
                <span className="member-list-name">{displayName}</span>
                {member.user?.username && (
                  <span className="member-list-username">@{member.user.username}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
