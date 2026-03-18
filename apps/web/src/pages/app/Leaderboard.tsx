import { useState, useEffect } from 'react';
import { X, Trophy } from 'lucide-react';
import { api } from '../../lib/api';
import Avatar from '../../components/ui/Avatar';

type LeaderboardEntry = {
  userId: string;
  username: string;
  displayName: string;
  avatarHash?: string | null;
  level?: number;
  xp?: number;
  coins?: number;
  messageCount?: number;
  score: number;
};

type Metric = 'messages' | 'level' | 'coins';
type Period = 'week' | 'all';

type Props = {
  guildId?: string;
  onClose: () => void;
};

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function Leaderboard({ guildId, onClose }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [metric, setMetric] = useState<Metric>('messages');
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [tab, setTab] = useState<'guild' | 'global'>('guild');

  useEffect(() => {
    setLoading(true);
    setError(false);
    const url = tab === 'guild' && guildId
      ? `/guilds/${guildId}/leaderboard?metric=${metric}&period=${period}`
      : `/leaderboard/global?metric=${metric}`;
    api.get<LeaderboardEntry[]>(url)
      .then(data => setEntries(Array.isArray(data) ? data : []))
      .catch(() => { setEntries([]); setError(true); })
      .finally(() => setLoading(false));
  }, [guildId, metric, period, tab, retryCount]);

  const metricLabel = (e: LeaderboardEntry) => {
    if (metric === 'level') return `Level ${e.level ?? 1}`;
    if (metric === 'coins') return `${e.coins ?? 0} coins`;
    return `${e.score} msgs`;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-lg)',
        width: 'min(480px, 95vw)', maxHeight: '600px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trophy size={20} style={{ color: '#FFD700' }} />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Leaderboard</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Tab bar (Guild / Global) */}
        <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0' }}>
          {(['guild', 'global'] as const).filter(t => t === 'global' || guildId).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
              background: tab === t ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: tab === t ? 'white' : 'var(--text-secondary)',
            }}>
              {t === 'guild' ? 'This Server' : 'Global'}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', padding: '12px 24px', flexWrap: 'wrap' }}>
          {(['messages', 'level', 'coins'] as Metric[]).map(m => (
            <button key={m} onClick={() => setMetric(m)} style={{
              padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)',
              cursor: 'pointer', fontSize: '12px', fontWeight: 500,
              background: metric === m ? 'var(--accent-primary-alpha)' : 'transparent',
              color: metric === m ? 'var(--accent-primary)' : 'var(--text-secondary)',
            }}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {(['week', 'all'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)',
              cursor: 'pointer', fontSize: '12px',
              background: period === p ? 'var(--bg-tertiary)' : 'transparent',
              color: 'var(--text-secondary)',
            }}>
              {p === 'week' ? 'This Week' : 'All Time'}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <div style={{ marginBottom: '8px' }}>Failed to load leaderboard</div>
              <button onClick={() => { setError(false); setRetryCount(c => c + 1); }} style={{ background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: '6px', padding: '6px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
            </div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No data yet</div>
          ) : entries.map((entry, i) => (
            <div key={entry.userId} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 8px', borderRadius: 'var(--radius-md)',
              background: i < 3 ? 'var(--bg-elevated)' : 'transparent',
              marginBottom: '4px',
              border: i < 3 ? '1px solid var(--stroke)' : 'none',
            }}>
              <div style={{
                width: '28px', textAlign: 'center', fontSize: i < 3 ? '18px' : '14px',
                fontWeight: 700, color: i < 3 ? MEDAL_COLORS[i] : 'var(--text-muted)',
                flexShrink: 0,
              }}>
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
              </div>
              <Avatar userId={entry.userId} avatarHash={entry.avatarHash} displayName={entry.displayName} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {entry.displayName}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{entry.username}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', flexShrink: 0 }}>
                {metricLabel(entry)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
