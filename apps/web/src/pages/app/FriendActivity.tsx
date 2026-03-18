import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, Users, Star, Zap, Gift, ArrowLeft, RefreshCw, Loader2, Gamepad2, Headphones, Eye, Circle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import Avatar from '../../components/ui/Avatar';
import { getSocket } from '../../lib/socket';

type FeedEvent = {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
};

type FilterType = 'all' | 'joined_server' | 'earned_achievement' | 'reached_level' | 'gifted_coins' | 'received_coins';

// Fallback map for achievement IDs stored without a human-readable name
const ACHIEVEMENT_NAMES: Record<string, string> = {
  first_message: 'First Words',
  social_butterfly: 'Social Butterfly',
  bookmarker: 'Bookmarker',
  gifter: 'Gifter',
  streak_7: 'Weekly Warrior',
  streak_30: 'Monthly Master',
  chatterbox: 'Chatterbox',
  veteran: 'Veteran',
  first_friend: 'Social Butterfly',
  popular: 'Popular',
  fame_receiver: 'Famous',
  guild_joiner: 'Server Explorer',
  first_purchase: 'First Purchase',
  big_spender: 'Big Spender',
  collector: 'Collector',
  gacha_lucky: 'Lucky Pull',
  early_adopter: 'Early Adopter',
  bug_hunter: 'Bug Hunter',
};

function getAchievementLabel(e: FeedEvent): string {
  const p = e.payload as any;
  const rawName = p.achievementName || p.achievementId || '';
  const name = ACHIEVEMENT_NAMES[rawName] || ACHIEVEMENT_NAMES[p.achievementId] || rawName || 'an achievement';
  return `earned ${name}`;
}

const EVENT_META: Record<string, { icon: React.ReactNode; color: string; label: (e: FeedEvent) => string; navigate?: (e: FeedEvent) => string | null }> = {
  joined_server: {
    icon: <Users size={14} />,
    color: '#3ba55c',
    label: (e) => `joined ${(e.payload as any).guildName ?? 'a server'}`,
    navigate: (e) => (e.payload as any).guildId ? `/guild/${(e.payload as any).guildId}` : null,
  },
  earned_achievement: {
    icon: <Star size={14} />,
    color: '#faa61a',
    label: getAchievementLabel,
  },
  reached_level: {
    icon: <Zap size={14} />,
    color: '#5865f2',
    label: (e) => `reached Level ${(e.payload as any).level ?? '?'}`,
  },
  gifted_coins: {
    icon: <Gift size={14} />,
    color: '#eb459e',
    label: (e) => `gifted ${(e.payload as any).amount ?? '?'} coins`,
  },
  received_coins: {
    icon: <Gift size={14} />,
    color: '#57f287',
    label: (e) => `received ${(e.payload as any).amount ?? '?'} coins`,
  },
};

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'joined_server', label: 'Joined Server' },
  { value: 'earned_achievement', label: 'Achievements' },
  { value: 'reached_level', label: 'Leveled Up' },
  { value: 'gifted_coins', label: 'Gifts' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

type FriendPresence = {
  id: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  activity?: { name: string; type: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  online: '#10b981', idle: '#f59e0b', dnd: '#ef4444', offline: '#6b7280',
};

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  PLAYING: <Gamepad2 size={12} />,
  LISTENING: <Headphones size={12} />,
  WATCHING: <Eye size={12} />,
};

const FriendActivity = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [friendPresences, setFriendPresences] = useState<FriendPresence[]>([]);
  const abortRef = useRef<AbortController>();

  const load = useCallback(async (append = false, before?: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const params: any = { limit: 30 };
      if (filter !== 'all') params.type = filter;
      if (before) params.before = before;
      const data = await api.activityFeed.list(params);
      if (signal.aborted) return;
      const items = Array.isArray(data) ? data : [];
      if (append) {
        setEvents(prev => [...prev, ...items]);
      } else {
        setEvents(items);
      }
      setHasMore(items.length >= 30);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (!append) setEvents([]);
    }
    if (append) setLoadingMore(false); else setLoading(false);
  }, [filter]);

  useEffect(() => {
    setEvents([]);
    setHasMore(true);
    load();
  }, [load]);

  // Load friend presences
  useEffect(() => {
    api.relationships.listFriends().then((friends: any[]) => {
      const presences: FriendPresence[] = (Array.isArray(friends) ? friends : []).map((f: any) => ({
        id: f.userId || f.id,
        username: f.username || '',
        displayName: f.displayName || f.username || '',
        avatarHash: f.avatarHash || null,
        status: f.presence?.status || f.status || 'offline',
        activity: f.presence?.activity || f.activity || null,
      }));
      setFriendPresences(presences);
    }).catch(() => {});

    // Listen for real-time presence updates
    const socket = getSocket();
    if (socket) {
      const handler = (data: { userId: string; status: string; activity?: any }) => {
        setFriendPresences(prev => prev.map(f =>
          f.id === data.userId ? { ...f, status: data.status as any, activity: data.activity || null } : f
        ));
      };
      socket.on('PRESENCE_UPDATE', handler);
      return () => { socket.off('PRESENCE_UPDATE', handler); };
    }
  }, []);

  const onlineFriends = friendPresences.filter(f => f.status !== 'offline');

  const loadMore = () => {
    if (loadingMore || !hasMore || events.length === 0) return;
    const last = events[events.length - 1];
    load(true, last.createdAt);
  };

  const handleEventClick = (event: FeedEvent) => {
    const meta = EVENT_META[event.type];
    if (meta?.navigate) {
      const path = meta.navigate(event);
      if (path) navigate(path);
    }
  };

  return (
    <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginBottom: '16px' }}>
          <ArrowLeft size={16} /> Back
        </button>

        {/* Online Friends Status Section */}
        {onlineFriends.length > 0 && (
          <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '12px' }}>
              <Circle size={8} fill="#10b981" stroke="none" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              Online Friends -- {onlineFriends.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {onlineFriends.slice(0, 10).map(friend => (
                <div
                  key={friend.id}
                  onClick={() => navigate(`/dms/${friend.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                    borderRadius: '8px', cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  className="hover-bg-tertiary"
                >
                  <Avatar userId={friend.id} avatarHash={friend.avatarHash} displayName={friend.displayName} size={32} status={friend.status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{friend.displayName}</div>
                    {friend.activity ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {ACTIVITY_ICONS[friend.activity.type] || null}
                        <span>
                          {friend.activity.type === 'PLAYING' ? 'Playing' : friend.activity.type === 'LISTENING' ? 'Listening to' : friend.activity.type === 'WATCHING' ? 'Watching' : friend.activity.type}
                          {' '}{friend.activity.name}
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: STATUS_COLORS[friend.status] }}>
                        {friend.status === 'online' ? 'Online' : friend.status === 'idle' ? 'Idle' : friend.status === 'dnd' ? 'Do Not Disturb' : 'Offline'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {onlineFriends.length > 10 && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '4px' }}>
                  +{onlineFriends.length - 10} more online
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={24} color="var(--accent-primary)" />
            <h1 style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-display)', margin: 0 }}>Activity Feed</h1>
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px', borderRadius: '6px' }}
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {FILTER_OPTIONS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                border: `1px solid ${filter === f.value ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                background: filter === f.value ? 'rgba(82,109,245,0.1)' : 'var(--bg-tertiary)',
                color: filter === f.value ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="spin" style={{ marginBottom: '8px' }} />
            <p>Loading activity...</p>
          </div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <Activity size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p style={{ fontSize: '15px', fontWeight: 600 }}>No recent activity</p>
            <p style={{ fontSize: '13px' }}>Add friends to see their activity here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {events.map(event => {
              const meta = EVENT_META[event.type];
              const isClickable = meta?.navigate ? !!meta.navigate(event) : false;
              return (
                <div
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', borderRadius: '8px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                    cursor: isClickable ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                  }}
                  className={isClickable ? 'hover-bg-tertiary' : ''}
                >
                  <Avatar userId={event.userId} avatarHash={event.avatarHash} displayName={event.displayName} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{event.displayName}</span>
                      <span style={{ color: meta?.color ?? 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                        {meta?.icon}
                        {meta?.label(event) ?? event.type}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{timeAgo(event.createdAt)}</span>
                </div>
              );
            })}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  margin: '16px auto 0', padding: '8px 24px', borderRadius: '20px',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                  color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600,
                  cursor: loadingMore ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                }}
              >
                {loadingMore ? <><Loader2 size={14} className="spin" /> Loading...</> : 'Load More'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendActivity;
