import { useState, useEffect, useCallback } from 'react';
import { Activity, UserPlus, MessageSquare, Server, Star, Music, Clock, RefreshCw } from 'lucide-react';
import { api, API_BASE } from '../lib/api';

interface ActivityEvent {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
}

const typeIcons: Record<string, typeof Activity> = {
  guild_join: Server,
  friend_request: UserPlus,
  message: MessageSquare,
  status_change: Activity,
  fame_received: Star,
  now_playing: Music,
};

const typeLabels: Record<string, (event: ActivityEvent) => string> = {
  guild_join: (e) => `joined ${(e.payload.guildName as string) || 'a server'}`,
  friend_request: () => 'sent a friend request',
  message: (e) => `posted in #${(e.payload.channelName as string) || 'channel'}`,
  status_change: (e) => `is now ${(e.payload.status as string) || 'online'}`,
  fame_received: (e) => `received ${(e.payload.amount as number) || 1} FAME`,
  now_playing: (e) => `is listening to ${(e.payload.track as string) || 'music'}`,
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.activityFeed.list({ type: typeFilter, limit: 30 });
      setEvents(data);
    } catch {
      // Activity feed may not have data yet
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const filterTypes = [
    { value: undefined, label: 'All' },
    { value: 'guild_join', label: 'Joins' },
    { value: 'status_change', label: 'Status' },
    { value: 'fame_received', label: 'FAME' },
  ];

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: '12px',
      border: '1px solid var(--stroke)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: '1px solid var(--stroke)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} color="var(--accent-primary)" />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>Activity Feed</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {filterTypes.map(f => (
            <button
              key={f.label}
              onClick={() => setTypeFilter(f.value)}
              style={{
                padding: '4px 8px', borderRadius: '6px', border: 'none',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                background: typeFilter === f.value ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: typeFilter === f.value ? '#000' : 'var(--text-muted)',
              }}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={loadEvents}
            style={{
              background: 'var(--bg-tertiary)', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer',
              width: '24px', height: '24px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Events */}
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Loading activity...
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No recent activity from your friends.
          </div>
        ) : (
          events.map(event => {
            const Icon = typeIcons[event.type] || Activity;
            const label = (typeLabels[event.type] || (() => event.type))(event);

            return (
              <div key={event.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 16px',
                borderBottom: '1px solid var(--stroke)',
                transition: 'background 0.15s',
              }}>
                {/* Avatar */}
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'var(--bg-tertiary)', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {event.avatarHash ? (
                    <img src={`${API_BASE}/files/${event.avatarHash}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                      {(event.displayName || event.username).charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ fontWeight: 600 }}>{event.displayName || event.username}</span>
                    {' '}
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    <Clock size={10} />
                    {formatTimeAgo(event.createdAt)}
                  </div>
                </div>

                {/* Type icon */}
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'var(--bg-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={14} color="var(--text-muted)" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
