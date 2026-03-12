import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface InsightsData {
  memberCount: number;
  memberGrowth7d: number;
  messages7d: number;
  topChannels: { channelId: string; name: string; messages: number }[];
  hourlyMessages: number[];
  dailyMessages: number[];
  dailyJoins: number[];
  dailyLeaves: number[];
  activeUsers24h: number;
  dateLabels: string[];
}

function StatCard({ value, label, sub, subColor, accentColor }: { value: number; label: string; sub?: string; subColor?: string; accentColor?: string }) {
  return (
    <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, border: '1px solid var(--stroke)', position: 'relative', overflow: 'hidden' }}>
      {accentColor && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accentColor }} />}
      <div style={{ fontSize: 32, fontWeight: 700 }}>{value.toLocaleString()}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{label}</div>
      {sub && <div style={{ color: subColor || 'var(--text-muted)', fontSize: 12, marginTop: 4, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

function BarChart({ data, labels, color, height = 180 }: { data: number[]; labels: string[]; color: string; height?: number }) {
  const max = Math.max(...data, 1);
  const barWidth = Math.max(12, Math.min(32, (600 / data.length) - 4));
  const chartWidth = data.length * (barWidth + 4);
  const chartHeight = height - 30;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${Math.max(chartWidth, 300)} ${height}`} preserveAspectRatio="xMinYEnd meet" style={{ overflow: 'visible' }}>
      {data.map((val, i) => {
        const barH = max > 0 ? (val / max) * (chartHeight - 10) : 0;
        const x = i * (barWidth + 4);
        const y = chartHeight - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barH, 1)} rx={3} fill={color} opacity={0.85} />
            {val > 0 && (
              <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="var(--text-muted)">{val}</text>
            )}
            <text x={x + barWidth / 2} y={height - 2} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
              {labels[i] || ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data, labels, color, height = 160 }: { data: number[]; labels: string[]; color: string; height?: number }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const chartHeight = height - 30;
  const padding = 10;
  const width = Math.max(data.length * 36, 300);
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const points = data.map((val, i) => {
    const x = padding + i * stepX;
    const y = chartHeight - (val / max) * (chartHeight - 20) + 5;
    return `${x},${y}`;
  }).join(' ');

  const fillPoints = `${padding},${chartHeight} ${points} ${padding + (data.length - 1) * stepX},${chartHeight}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYEnd meet">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill="url(#lineGrad)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((val, i) => {
        const x = padding + i * stepX;
        const y = chartHeight - (val / max) * (chartHeight - 20) + 5;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={3} fill={color} />
            {val > 0 && <text x={x} y={y - 8} textAnchor="middle" fontSize={9} fill="var(--text-muted)">{val}</text>}
            <text x={x} y={height - 2} textAnchor="middle" fontSize={9} fill="var(--text-muted)">{labels[i] || ''}</text>
          </g>
        );
      })}
    </svg>
  );
}

function HourlyHeatmap({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const hourLabels = Array.from({ length: 24 }, (_, i) => i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`);

  // Find peak hour(s) — all hours that share the max value (if max > 0)
  const peakIndices = new Set<number>();
  if (max > 0) {
    data.forEach((val, i) => { if (val === max) peakIndices.add(i); });
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2 }}>
        {data.map((val, i) => {
          const opacity = max > 0 ? 0.1 + (val / max) * 0.9 : 0.1;
          const isPeak = peakIndices.has(i);
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div
                title={`${hourLabels[i]}: ${val} messages${isPeak ? ' (peak)' : ''}`}
                style={{
                  width: '100%',
                  height: 28,
                  borderRadius: 4,
                  backgroundColor: isPeak ? '#f59e0b' : 'var(--accent-primary)',
                  opacity,
                  minWidth: 8,
                  border: isPeak ? '2px solid #f59e0b' : 'none',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: 8, color: isPeak ? '#f59e0b' : 'var(--text-muted)', fontWeight: isPeak ? 700 : 400 }}>{i % 3 === 0 || isPeak ? hourLabels[i] : ''}</span>
            </div>
          );
        })}
      </div>
      {peakIndices.size > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          Peak hour{peakIndices.size > 1 ? 's' : ''}: <span style={{ color: '#f59e0b', fontWeight: 600 }}>{[...peakIndices].map(i => hourLabels[i]).join(', ')}</span> ({max} messages)
        </div>
      )}
    </>
  );
}

export default function GuildInsights({ guildId }: { guildId: string }) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [range, setRange] = useState<7 | 30>(7);

  useEffect(() => {
    api.get<InsightsData>(`/guilds/${guildId}/insights?range=${range}`).then(setData).catch(() => {});
  }, [guildId, range]);

  if (!data) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading insights...</div>;

  const sectionStyle: React.CSSProperties = {
    background: 'var(--bg-tertiary)',
    borderRadius: 8,
    border: '1px solid var(--stroke)',
    padding: 16,
  };

  return (
    <div style={{ padding: 24, color: 'var(--text-primary)', maxWidth: 900, overflow: 'auto' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Server Insights</h2>

      {/* Stats row */}
      <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard value={data.memberCount} label="Total Members" accentColor="#6366f1" />
        <StatCard value={data.messages7d} label="Messages (7d)" accentColor="#f59e0b" />
        <StatCard value={data.activeUsers24h} label="Active Users (24h)" accentColor="#10b981" />
        <StatCard
          value={data.memberGrowth7d}
          label="Member Growth"
          sub={`${data.memberGrowth7d >= 0 ? '\u2191' : '\u2193'} ${data.memberGrowth7d >= 0 ? '+' : ''}${data.memberGrowth7d} this week`}
          subColor={data.memberGrowth7d >= 0 ? '#43b581' : '#f04747'}
          accentColor="#ec4899"
        />
      </div>

      {/* Date range selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([7, 30] as const).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: `1px solid ${range === r ? 'var(--accent-primary)' : 'var(--stroke)'}`,
              background: range === r ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: range === r ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {r} days
          </button>
        ))}
      </div>

      {/* Messages per Day */}
      <div style={{ ...sectionStyle, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Messages per Day</h3>
        <BarChart data={data.dailyMessages} labels={data.dateLabels} color="var(--accent-primary)" />
      </div>

      {/* Member Growth line chart */}
      <div style={{ ...sectionStyle, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Daily Member Joins</h3>
        <LineChart data={data.dailyJoins} labels={data.dateLabels} color="#43b581" />
      </div>

      {/* Active Hours heatmap */}
      <div style={{ ...sectionStyle, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Active Hours (Last 24h)</h3>
        <HourlyHeatmap data={data.hourlyMessages} />
      </div>

      {/* Top Channels */}
      {data.topChannels.length > 0 && (
        <div style={{ ...sectionStyle }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Top Channels (7 days)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.topChannels.map((ch, i) => {
              const maxMsg = data.topChannels[0]?.messages || 1;
              const pct = (ch.messages / maxMsg) * 100;
              return (
                <div key={ch.channelId} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderRadius: 6, border: '1px solid var(--stroke)', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'var(--accent-primary)', opacity: 0.08, borderRadius: 6 }} />
                  <span style={{ position: 'relative', zIndex: 1 }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>#{i + 1}</span>
                    #{ch.name}
                  </span>
                  <span style={{ color: 'var(--text-muted)', position: 'relative', zIndex: 1 }}>{ch.messages.toLocaleString()} messages</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
