import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../../lib/api';
import { onPresenceUpdate, onSocketReconnect } from '../../lib/socket';
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
  const fetchCountRef = useRef(0);

  const fetchMembers = useCallback(() => {
    const thisCall = ++fetchCountRef.current;
    api.guilds.getMembers(guildId, { limit: 200 })
      .then((data) => {
        if (thisCall !== fetchCountRef.current) return; // stale
        setMembers(data as unknown as Member[]);
        setLoading(false);
      })
      .catch(() => { if (thisCall === fetchCountRef.current) setLoading(false); });
  }, [guildId]);

  useEffect(() => {
    setLoading(true);
    fetchMembers();
  }, [fetchMembers]);

  // Refetch member list on socket reconnect (picks up fresh presence from Redis)
  useEffect(() => {
    const unsub = onSocketReconnect(() => {
      // Small delay so the server has time to set presence in Redis first
      setTimeout(fetchMembers, 1500);
    });
    return unsub;
  }, [fetchMembers]);

  // Refetch when tab becomes visible again (presence may have changed while away)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchMembers();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [fetchMembers]);

  // Periodic presence sync every 60s to catch any missed updates
  useEffect(() => {
    const iv = setInterval(fetchMembers, 60_000);
    return () => clearInterval(iv);
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

  const [onlineCollapsed, setOnlineCollapsed] = useState(false);
  const [offlineCollapsed, setOfflineCollapsed] = useState(false);

  const online = members.filter((m) => m.status && m.status !== 'offline' && m.status !== 'invisible');
  const offline = members.filter((m) => !m.status || m.status === 'offline' || m.status === 'invisible');

  return (
    <div className="member-list-panel">
      <div className="member-list-scroll">
        {loading ? (
          <div className="member-list-loading">Loading...</div>
        ) : (
          <>
            <div
              className="member-list-section-header"
              onClick={() => setOnlineCollapsed(p => !p)}
              style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span style={{ display: 'inline-block', transition: 'transform 0.15s', transform: onlineCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', fontSize: '10px' }}>▼</span>
              ONLINE — {online.length}
            </div>
            {!onlineCollapsed && online.map((m) => (
              <MemberRow key={m.userId} member={m} onMemberClick={onMemberClick} />
            ))}
            {offline.length > 0 && (
              <>
                <div
                  className="member-list-section-header"
                  onClick={() => setOfflineCollapsed(p => !p)}
                  style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span style={{ display: 'inline-block', transition: 'transform 0.15s', transform: offlineCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', fontSize: '10px' }}>▼</span>
                  OFFLINE — {offline.length}
                </div>
                {!offlineCollapsed && offline.map((m) => (
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
