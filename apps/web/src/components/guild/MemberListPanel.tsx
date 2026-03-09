import { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { onPresenceUpdate } from '../../lib/socket';
import Avatar from '../ui/Avatar';

interface Member {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarHash?: string | null;
  nickname?: string | null;
  status?: 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';
  activity?: { name: string; type: string } | null;
  roles: string[];
}

interface Props {
  guildId: string;
  onMemberClick?: (userId: string, displayName: string, e: React.MouseEvent) => void;
}

function activityLabel(type: string): string {
  if (type === 'PLAYING') return 'Playing';
  if (type === 'WATCHING') return 'Watching';
  if (type === 'LISTENING') return 'Listening to';
  if (type === 'STREAMING') return 'Streaming';
  return '';
}

function MemberRow({ member, onMemberClick }: { member: Member; onMemberClick?: Props['onMemberClick'] }) {
  const name = member.nickname || member.displayName || member.username;

  return (
    <div
      className="member-list-item"
      onClick={(e) => onMemberClick?.(member.userId, name, e)}
    >
      <div className="member-avatar-wrap">
        <Avatar
          userId={member.userId}
          avatarHash={member.avatarHash}
          displayName={name}
          size={32}
          status={member.status || 'offline'}
        />
      </div>
      <div className="member-info">
        <div className="member-name">{name}</div>
        {member.activity && (
          <div className="member-activity">
            {activityLabel(member.activity.type)} {member.activity.name}
          </div>
        )}
      </div>
    </div>
  );
}

export function MemberListPanel({ guildId, onMemberClick }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(() => {
    api.guilds.getMembers(guildId, { limit: 100 })
      .then((data) => {
        setMembers(data as unknown as Member[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [guildId]);

  useEffect(() => {
    setLoading(true);
    fetchMembers();
  }, [fetchMembers]);

  // Subscribe to real-time presence updates
  useEffect(() => {
    const unsub = onPresenceUpdate((payload) => {
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === payload.userId
            ? { ...m, status: payload.status, ...('activity' in payload ? { activity: (payload as any).activity } : {}) }
            : m,
        ),
      );
    });
    return unsub;
  }, []);

  const online = members.filter((m) => m.status && m.status !== 'offline' && m.status !== 'invisible');
  const offline = members.filter((m) => !m.status || m.status === 'offline' || m.status === 'invisible');

  return (
    <div className="member-list-panel">
      <div className="member-list-scroll">
        {loading ? (
          <div className="member-list-loading">Loading...</div>
        ) : (
          <>
            <div className="member-list-section-header">
              ONLINE — {online.length}
            </div>
            {online.map((m) => (
              <MemberRow key={m.userId} member={m} onMemberClick={onMemberClick} />
            ))}
            {offline.length > 0 && (
              <>
                <div className="member-list-section-header">
                  OFFLINE — {offline.length}
                </div>
                {offline.map((m) => (
                  <MemberRow key={m.userId} member={m} onMemberClick={onMemberClick} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
