import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface InsightsData {
  memberCount: number;
  memberGrowth7d: number;
  messages7d: number;
  topChannels: { channelId: string; name: string; messages: number }[];
}

export default function GuildInsights({ guildId }: { guildId: string }) {
  const [data, setData] = useState<InsightsData | null>(null);

  useEffect(() => {
    api.get<InsightsData>(`/guilds/${guildId}/insights`).then(setData).catch(() => {});
  }, [guildId]);

  if (!data) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading insights...</div>;

  return (
    <div style={{ padding: 24, color: 'var(--text-primary)' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Server Insights</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, border: '1px solid var(--stroke)' }}>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{data.memberCount}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Total Members</div>
          <div style={{ color: '#43b581', fontSize: 12, marginTop: 4 }}>+{data.memberGrowth7d} this week</div>
        </div>
        <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, border: '1px solid var(--stroke)' }}>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{data.messages7d}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Messages (7d)</div>
        </div>
      </div>
      {data.topChannels.length > 0 && (
        <>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 12 }}>Top Channels (7 days)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.topChannels.map(ch => (
              <div key={ch.channelId} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-tertiary)', padding: '8px 16px', borderRadius: 6, border: '1px solid var(--stroke)' }}>
                <span>#{ch.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>{ch.messages} messages</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
