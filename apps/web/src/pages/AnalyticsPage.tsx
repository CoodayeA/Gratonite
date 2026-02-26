import { useEffect, useState, CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { shouldEnableUiV2Tokens } from '@/theme/initTheme';

interface AnalyticsData {
  messagesToday: number;
  messagesThisWeek: number;
  messagesThisMonth: number;
  activeMembersToday: number;
  activeMembersThisWeek: number;
  activeMembersThisMonth: number;
  newMembersToday: number;
  newMembersThisWeek: number;
  newMembersThisMonth: number;
  leftMembersToday: number;
  leftMembersThisWeek: number;
  leftMembersThisMonth: number;
  topChannels: Array<{ channelId: string; channelName: string; messageCount: number }>;
  topReactions: Array<{ emoji: string; count: number }>;
}

const s = {
  page: {
    padding: 24,
    color: '#e8e4e0',
    minHeight: '100%',
    background: '#2c2c3e',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 64,
    color: '#a8a4b8',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #4a4660',
    borderTopColor: '#d4af37',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: 48,
    color: '#e85a6e',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: '#e8e4e0',
  },
  periodSelector: {
    display: 'flex',
    gap: 4,
    background: '#25243a',
    borderRadius: 8,
    padding: 4,
  },
  periodBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  periodBtnActive: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 6,
    background: '#413d58',
    color: '#e8e4e0',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  overview: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 32,
  },
  card: {
    background: '#25243a',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardSuccess: {
    background: '#25243a',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    borderLeft: '3px solid #d4af37',
  },
  cardDanger: {
    background: '#25243a',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    borderLeft: '3px solid #e85a6e',
  },
  cardTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 500,
    color: '#a8a4b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardValue: {
    fontSize: 32,
    fontWeight: 700,
    color: '#e8e4e0',
  },
  details: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 24,
  },
  section: {
    background: '#25243a',
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: 16,
    fontWeight: 600,
    color: '#e8e4e0',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  empty: {
    color: '#6e6a80',
    fontSize: 14,
    textAlign: 'center',
    padding: 24,
    margin: 0,
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 0',
    borderBottom: '1px solid #4a4660',
  },
  rank: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: '#413d58',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 600,
    color: '#a8a4b8',
    flexShrink: 0,
  },
  label: {
    flex: 1,
    fontSize: 14,
    color: '#e8e4e0',
  },
  count: {
    fontSize: 13,
    color: '#a8a4b8',
    fontWeight: 500,
  },
  emoji: {
    fontSize: 20,
    flex: 1,
  },
};

export function AnalyticsPage() {
  const { guildId } = useParams();
  const uiV2TokensEnabled = shouldEnableUiV2Tokens();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');

  useEffect(() => {
    async function fetchAnalytics() {
      if (!guildId) return;
      try {
        const res = await fetch(`/api/v1/guilds/${guildId}/analytics?period=${period}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch analytics');
        const data = await res.json();
        setAnalytics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [guildId, period]);

  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.loading}>
          <div style={s.spinner} />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div style={s.page}>
        <div style={s.error}>
          <p>Unable to load analytics</p>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Analytics</h1>
        <div style={s.periodSelector}>
          <button
            style={period === 'day' ? s.periodBtnActive : s.periodBtn}
            onClick={() => setPeriod('day')}
          >
            Today
          </button>
          <button
            style={period === 'week' ? s.periodBtnActive : s.periodBtn}
            onClick={() => setPeriod('week')}
          >
            This Week
          </button>
          <button
            style={period === 'month' ? s.periodBtnActive : s.periodBtn}
            onClick={() => setPeriod('month')}
          >
            This Month
          </button>
        </div>
      </div>

      <div style={s.overview}>
        <div style={s.card}>
          <h3 style={s.cardTitle}>Messages</h3>
          <div style={s.cardValue}>
            {period === 'day' && analytics.messagesToday}
            {period === 'week' && analytics.messagesThisWeek}
            {period === 'month' && analytics.messagesThisMonth}
          </div>
        </div>
        <div style={s.card}>
          <h3 style={s.cardTitle}>Active Members</h3>
          <div style={s.cardValue}>
            {period === 'day' && analytics.activeMembersToday}
            {period === 'week' && analytics.activeMembersThisWeek}
            {period === 'month' && analytics.activeMembersThisMonth}
          </div>
        </div>
        <div style={s.cardSuccess}>
          <h3 style={s.cardTitle}>New Members</h3>
          <div style={s.cardValue}>
            {period === 'day' && analytics.newMembersToday}
            {period === 'week' && analytics.newMembersThisWeek}
            {period === 'month' && analytics.newMembersThisMonth}
          </div>
        </div>
        <div style={s.cardDanger}>
          <h3 style={s.cardTitle}>Left</h3>
          <div style={s.cardValue}>
            {period === 'day' && analytics.leftMembersToday}
            {period === 'week' && analytics.leftMembersThisWeek}
            {period === 'month' && analytics.leftMembersThisMonth}
          </div>
        </div>
      </div>

      <div style={s.details}>
        <div style={s.section}>
          <h2 style={s.sectionTitle}>Top Channels</h2>
          <div style={s.list}>
            {analytics.topChannels.length === 0 ? (
              <p style={s.empty}>No channel data yet</p>
            ) : (
              analytics.topChannels.map((channel, idx) => (
                <div key={channel.channelId} style={s.listItem}>
                  <span style={s.rank}>{idx + 1}</span>
                  <span style={s.label}>{channel.channelName}</span>
                  <span style={s.count}>{channel.messageCount} messages</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={s.section}>
          <h2 style={s.sectionTitle}>Top Reactions</h2>
          <div style={s.list}>
            {analytics.topReactions.length === 0 ? (
              <p style={s.empty}>No reaction data yet</p>
            ) : (
              analytics.topReactions.map((reaction, idx) => (
                <div key={idx} style={s.listItem}>
                  <span style={s.rank}>{idx + 1}</span>
                  <span style={s.emoji}>{reaction.emoji}</span>
                  <span style={s.count}>{reaction.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
