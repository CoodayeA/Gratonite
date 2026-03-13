import { useState, useEffect, useCallback } from 'react';
import { Activity, Users, Star, Zap, Gift, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import Avatar from '../../components/ui/Avatar';

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
    label: (e) => `earned ${(e.payload as any).achievementName ?? (e.payload as any).achievementId ?? 'an achievement'}`,
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

const FriendActivity = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  const load = useCallback(async (append = false, before?: string) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const params: any = { limit: 30 };
      if (filter !== 'all') params.type = filter;
      if (before) params.before = before;
      const data = await api.activityFeed.list(params);
      const items = Array.isArray(data) ? data : [];
      if (append) {
        setEvents(prev => [...prev, ...items]);
      } else {
        setEvents(items);
      }
      setHasMore(items.length >= 30);
    } catch {
      if (!append) setEvents([]);
    }
    if (append) setLoadingMore(false); else setLoading(false);
  }, [filter]);

  useEffect(() => {
    setEvents([]);
    setHasMore(true);
    load();
  }, [load]);

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
                  onMouseEnter={e => { if (isClickable) (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                  onMouseLeave={e => { if (isClickable) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
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
