import { useEffect, useState, useCallback, useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { api } from '../../lib/api';
import { onPresenceUpdate, onSocketReconnect } from '../../lib/socket';
import Avatar from '../ui/Avatar';
import { RemoteBadge } from '../ui/RemoteBadge';
import { SkeletonMemberList } from '../ui/SkeletonLoader';

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
  isBot?: boolean;
  isFederated?: boolean;
  federationAddress?: string | null;
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

type VirtualRow =
  | { type: 'header'; label: string; count: number; collapsed: boolean; toggle: () => void }
  | { type: 'member'; member: Member };

const HEADER_HEIGHT = 32;
const MEMBER_HEIGHT = 44;

const MemberRow = memo(function MemberRow({ member, onMemberClick }: { member: Member; onMemberClick?: Props['onMemberClick'] }) {
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
        <div className="member-name">{name}{member.isBot && <span style={{ display: 'inline-block', marginLeft: '4px', background: 'var(--accent-primary)', color: '#000', fontSize: '8px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', verticalAlign: 'middle', letterSpacing: '0.5px' }}>BOT</span>}{member.isFederated && <RemoteBadge address={member.federationAddress} size={11} />}</div>
        {member.activity && (
          <div className="member-activity">
            {activityLabel(member.activity.type)} {member.activity.name}
          </div>
        )}
      </div>
    </div>
  );
});

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

  // Build flat virtualized row list
  const rows: VirtualRow[] = [];
  rows.push({ type: 'header', label: 'ONLINE', count: online.length, collapsed: onlineCollapsed, toggle: () => setOnlineCollapsed(p => !p) });
  if (!onlineCollapsed) {
    online.forEach(m => rows.push({ type: 'member', member: m }));
  }
  if (offline.length > 0) {
    rows.push({ type: 'header', label: 'OFFLINE', count: offline.length, collapsed: offlineCollapsed, toggle: () => setOfflineCollapsed(p => !p) });
    if (!offlineCollapsed) {
      offline.forEach(m => rows.push({ type: 'member', member: m }));
    }
  }

  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => rows[index].type === 'header' ? HEADER_HEIGHT : MEMBER_HEIGHT,
    overscan: 10,
  });

  return (
    <div className="member-list-panel">
      <div className="member-list-scroll" ref={scrollRef}>
        {loading ? (
          <SkeletonMemberList count={8} />
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const row = rows[vItem.index];
              if (row.type === 'header') {
                return (
                  <div
                    key={`header-${row.label}`}
                    className="member-list-section-header"
                    onClick={row.toggle}
                    style={{
                      cursor: 'pointer',
                      userSelect: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${vItem.size}px`,
                      transform: `translateY(${vItem.start}px)`,
                    }}
                  >
                    <span style={{ display: 'inline-block', transition: 'transform 0.15s', transform: row.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', fontSize: '10px' }}>▼</span>
                    {row.label} — {row.count}
                  </div>
                );
              }
              return (
                <div
                  key={row.member.userId}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${vItem.size}px`,
                    transform: `translateY(${vItem.start}px)`,
                  }}
                >
                  <MemberRow member={row.member} onMemberClick={onMemberClick} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
