import { useState, useEffect } from 'react';
import { Trophy, MessageSquare, Heart, Star, TrendingUp } from 'lucide-react';
import { API_BASE, getAccessToken } from '../../lib/api';

interface TopMessage {
  id: string;
  content: string;
  authorName: string;
  authorAvatar: string | null;
  reactionCount: number;
  replyCount: number;
  channelName: string;
  createdAt: string;
}

export default function TopMessages({ guildId }: { guildId: string }) {
  const [messages, setMessages] = useState<TopMessage[]>([]);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const token = getAccessToken();
    fetch(`${API_BASE}/guilds/${guildId}/top-messages?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [guildId, period]);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Trophy size={22} style={{ color: '#f59e0b' }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Top Messages</h2>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['week', 'month', 'all'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ padding: '6px 14px', borderRadius: 14, border: 'none', background: period === p ? 'var(--accent-primary)' : 'var(--bg-elevated)', color: period === p ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 500, textTransform: 'capitalize' }}>
              {p === 'all' ? 'All Time' : `This ${p}`}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton-pulse" style={{ height: 80, borderRadius: 8 }} />)}
        </div>
      ) : messages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <TrendingUp size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>No messages with reactions yet this {period}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((msg, i) => (
            <div key={msg.id} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 14, border: '1px solid var(--border-primary)', display: 'flex', gap: 12, alignItems: 'start' }}>
              <span style={{ fontSize: 20, minWidth: 28, textAlign: 'center' }}>{medals[i] || `#${i + 1}`}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{msg.authorName}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>in #{msg.channelName}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.content}</p>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Heart size={12} /> {msg.reactionCount}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MessageSquare size={12} /> {msg.replyCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
