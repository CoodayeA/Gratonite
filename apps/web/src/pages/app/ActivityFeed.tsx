import { useState, useEffect } from 'react';
import { X, Zap, Star, Users, Gift, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import Avatar from '../../components/ui/Avatar';
import LoadingRow from '../../components/ui/LoadingRow';

type FeedEvent = {
  id: string;
  userId: string;
  type: 'joined_server' | 'earned_achievement' | 'reached_level' | 'gifted_coins' | 'received_coins';
  payload: Record<string, unknown>;
  createdAt: string;
  username: string;
  displayName: string;
  avatarHash?: string | null;
};

// Fallback map for achievement IDs that were stored without a human-readable name
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

const EVENT_ICONS: Record<string, { icon: React.ReactNode; color: string; label: (e: FeedEvent) => string }> = {
  joined_server: {
    icon: <Users size={14} />,
    color: '#3ba55c',
    label: (_e) => `joined a server`,
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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ActivityFeed({ onClose }: { onClose: () => void }) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    api.get<FeedEvent[]>('/users/@me/feed')
      .then(data => setEvents(Array.isArray(data) ? data : []))
      .catch(() => { setEvents([]); setError(true); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-lg)',
        width: 'min(420px, 95vw)', maxHeight: '560px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--stroke)' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Activity Feed</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button aria-label="Refresh" onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px' }}>
              <RefreshCw size={16} />
            </button>
            <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px' }}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
          {loading ? (
            <div style={{ padding: '40px 24px' }}><LoadingRow inline label="Loading activity…" /></div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <p style={{ color: 'var(--error)', marginBottom: '8px' }}>Failed to load activity feed.</p>
              <button onClick={load} style={{ background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: '6px', padding: '6px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
            </div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
              <Users size={36} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>No activity yet</p>
              <p style={{ fontSize: '13px' }}>Add friends to see their unlocks, pulls, and milestones here.</p>
            </div>
          ) : events.map(event => {
            const meta = EVENT_ICONS[event.type];
            return (
              <div key={event.id} style={{
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                padding: '10px 8px', borderRadius: 'var(--radius-md)',
              }}>
                <Avatar userId={event.userId} avatarHash={event.avatarHash} displayName={event.displayName} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    <strong>{event.displayName}</strong>{' '}
                    <span style={{ color: meta?.color ?? 'var(--accent-primary)' }}>
                      {meta?.icon}{' '}
                    </span>
                    {meta?.label(event) ?? event.type}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {timeAgo(event.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
