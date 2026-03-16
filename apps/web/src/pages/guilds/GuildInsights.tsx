import { useEffect, useState, useCallback } from 'react';
import { api, API_BASE, getAccessToken } from '../../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface GrowthData {
  labels: string[];
  data: number[];
  cumulative: number[];
}

interface HeatmapData {
  grid: number[][];
  peak: { day: string; hour: number; count: number };
}

interface ChannelComparisonData {
  channels: { name: string; count: number }[];
}

interface EngagementData {
  labels: string[];
  activeUsers: number[];
  messagesPerDay: number[];
  avgResponseSeconds: number;
}

interface ModerationData {
  volume: { labels: string[]; data: number[] };
  topWarned: { userId: string; username: string; displayName: string | null; warningCount: number }[];
  moderatorWorkload: { moderatorId: string; username: string; displayName: string | null; actionCount: number }[];
  funnel: { warnings: number; timeouts: number; bans: number };
  actionBreakdown: { action: string; count: number }[];
}

type RangeOption = 7 | 30 | 90;

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function StatCard({ value, label, sub, subColor, accentColor }: { value: number | string; label: string; sub?: string; subColor?: string; accentColor?: string }) {
  return (
    <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, border: '1px solid var(--stroke)', position: 'relative', overflow: 'hidden' }}>
      {accentColor && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accentColor }} />}
      <div style={{ fontSize: 32, fontWeight: 700 }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
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

function LineChart({ data, labels, color, height = 160, gradientId = 'lineGrad' }: { data: number[]; labels: string[]; color: string; height?: number; gradientId?: string }) {
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
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${gradientId})`} />
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

function DualLineChart({ data1, data2, labels, color1, color2, label1, label2, height = 180 }: {
  data1: number[]; data2: number[]; labels: string[];
  color1: string; color2: string; label1: string; label2: string; height?: number;
}) {
  if (data1.length === 0) return null;
  const max = Math.max(...data1, ...data2, 1);
  const chartHeight = height - 40;
  const padding = 10;
  const width = Math.max(data1.length * 36, 300);
  const stepX = data1.length > 1 ? (width - padding * 2) / (data1.length - 1) : 0;

  const makePoints = (data: number[]) =>
    data.map((val, i) => `${padding + i * stepX},${chartHeight - (val / max) * (chartHeight - 20) + 5}`).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYEnd meet">
      <polyline points={makePoints(data1)} fill="none" stroke={color1} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={makePoints(data2)} fill="none" stroke={color2} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 2" />
      {data1.map((_, i) => {
        const x = padding + i * stepX;
        return (
          <text key={i} x={x} y={height - 2} textAnchor="middle" fontSize={9} fill="var(--text-muted)">{labels[i] || ''}</text>
        );
      })}
      {/* Legend */}
      <rect x={width - 180} y={4} width={10} height={10} rx={2} fill={color1} />
      <text x={width - 166} y={13} fontSize={10} fill="var(--text-secondary)">{label1}</text>
      <rect x={width - 90} y={4} width={10} height={10} rx={2} fill={color2} />
      <text x={width - 76} y={13} fontSize={10} fill="var(--text-secondary)">{label2}</text>
    </svg>
  );
}

function HourlyHeatmap({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const hourLabels = Array.from({ length: 24 }, (_, i) => i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`);

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
                  width: '100%', height: 28, borderRadius: 4,
                  backgroundColor: isPeak ? '#f59e0b' : 'var(--accent-primary)',
                  opacity, minWidth: 8,
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

// ---------------------------------------------------------------------------
// Activity Heatmap (7x24 grid: day-of-week x hour)
// ---------------------------------------------------------------------------

function ActivityHeatmapGrid({ grid, peak }: HeatmapData) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hourLabels = Array.from({ length: 24 }, (_, i) => i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`);
  const flatMax = Math.max(...grid.flat(), 1);

  const getColor = (val: number): string => {
    if (val === 0) return 'var(--bg-elevated)';
    const intensity = val / flatMax;
    if (intensity < 0.25) return '#1a3a2a';
    if (intensity < 0.5) return '#1e6b3a';
    if (intensity < 0.75) return '#27a94b';
    return '#43b581';
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 2 }}>
        {/* Header row: hours */}
        <div />
        {hourLabels.map((h, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 8, color: 'var(--text-muted)' }}>{i % 3 === 0 ? h : ''}</div>
        ))}
        {/* Data rows */}
        {grid.map((row, dow) => (
          <>
            <div key={`label-${dow}`} style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>{dayNames[dow]}</div>
            {row.map((val, hour) => {
              const isPeak = peak.day === dayNames[dow] && peak.hour === hour && peak.count > 0;
              return (
                <div
                  key={`${dow}-${hour}`}
                  title={`${dayNames[dow]} ${hourLabels[hour]}: ${val} messages${isPeak ? ' (peak)' : ''}`}
                  style={{
                    width: '100%', aspectRatio: '1', borderRadius: 3,
                    backgroundColor: getColor(val),
                    border: isPeak ? '2px solid #f59e0b' : '1px solid transparent',
                    boxSizing: 'border-box',
                    minHeight: 14,
                  }}
                />
              );
            })}
          </>
        ))}
      </div>
      {peak.count > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          Peak: <span style={{ color: '#f59e0b', fontWeight: 600 }}>{peak.day} at {hourLabels[peak.hour]}</span> ({peak.count} messages)
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal Bar Chart (for channel comparison)
// ---------------------------------------------------------------------------

function HorizontalBarChart({ items, color }: { items: { label: string; value: number }[]; color?: string }) {
  const max = items.length > 0 ? items[0].value : 1;
  const colors = ['#6366f1', '#f59e0b', '#22c55e', '#ec4899', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => {
        const pct = max > 0 ? (item.value / max) * 100 : 0;
        const barColor = color || colors[i % colors.length];
        return (
          <div key={i} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderRadius: 6, border: '1px solid var(--stroke)', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: barColor, opacity: 0.1, borderRadius: 6 }} />
            <span style={{ position: 'relative', zIndex: 1, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 11 }}>#{i + 1}</span>
              #{item.label}
            </span>
            <span style={{ color: 'var(--text-muted)', position: 'relative', zIndex: 1, fontWeight: 600, fontSize: 13 }}>{item.value.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnel Visualization
// ---------------------------------------------------------------------------

function FunnelChart({ steps }: { steps: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...steps.map(s => s.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {steps.map((step, i) => {
        const pct = max > 0 ? Math.max((step.value / max) * 100, 8) : 8;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 90, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0 }}>{step.label}</div>
            <div style={{ flex: 1, position: 'relative', height: 32 }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 6,
                background: step.color, opacity: 0.8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'width 0.3s ease',
              }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{step.value}</span>
              </div>
            </div>
            {i < steps.length - 1 && steps[i].value > 0 && (
              <div style={{ width: 50, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', flexShrink: 0 }}>
                {Math.round((steps[i + 1].value / steps[i].value) * 100)}%
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Moderation Analytics Tab
// ---------------------------------------------------------------------------

function ModerationAnalytics({ guildId, range }: { guildId: string; range: RangeOption }) {
  const [modData, setModData] = useState<ModerationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<ModerationData>(`/stats/guilds/${guildId}/moderation?range=${range}`)
      .then(setModData)
      .catch(() => setModData(null))
      .finally(() => setLoading(false));
  }, [guildId, range]);

  const sectionStyle: React.CSSProperties = {
    background: 'var(--bg-tertiary)', borderRadius: 8,
    border: '1px solid var(--stroke)', padding: 16, marginBottom: 16,
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading moderation analytics...</div>;
  if (!modData) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Failed to load moderation data.</div>;

  const shortLabels = modData.volume.labels.map(l => {
    const d = new Date(l);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });

  const totalActions = modData.volume.data.reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard value={totalActions} label="Total Actions" accentColor="#ef4444" />
        <StatCard value={modData.funnel.warnings} label="Warnings" accentColor="#f59e0b" />
        <StatCard value={modData.funnel.timeouts} label="Timeouts" accentColor="#f97316" />
        <StatCard value={modData.funnel.bans} label="Bans" accentColor="#dc2626" />
      </div>

      {/* Mod action volume chart */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Mod Actions Over Time</h3>
        <LineChart data={modData.volume.data} labels={shortLabels} color="#ef4444" gradientId="modVolumeGrad" />
      </div>

      {/* Warning-to-Ban Funnel */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Warning to Ban Funnel</h3>
        <FunnelChart steps={[
          { label: 'Warnings', value: modData.funnel.warnings, color: '#f59e0b' },
          { label: 'Timeouts', value: modData.funnel.timeouts, color: '#f97316' },
          { label: 'Bans', value: modData.funnel.bans, color: '#dc2626' },
        ]} />
      </div>

      {/* Top warned users */}
      {modData.topWarned.length > 0 && (
        <div style={sectionStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Most Warned Users</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {modData.topWarned.map((user, i) => {
              const maxW = modData.topWarned[0]?.warningCount || 1;
              const pct = (user.warningCount / maxW) * 100;
              return (
                <div key={user.userId} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderRadius: 6, border: '1px solid var(--stroke)', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: '#f59e0b', opacity: 0.1, borderRadius: 6 }} />
                  <span style={{ position: 'relative', zIndex: 1, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 11 }}>#{i + 1}</span>
                    {user.displayName || user.username}
                  </span>
                  <span style={{ color: '#f59e0b', position: 'relative', zIndex: 1, fontWeight: 600, fontSize: 13 }}>
                    {user.warningCount} warning{user.warningCount !== 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Moderator workload */}
      {modData.moderatorWorkload.length > 0 && (
        <div style={sectionStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Moderator Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {modData.moderatorWorkload.map((mod, i) => {
              const maxA = modData.moderatorWorkload[0]?.actionCount || 1;
              const pct = (mod.actionCount / maxA) * 100;
              return (
                <div key={mod.moderatorId} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderRadius: 6, border: '1px solid var(--stroke)', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: '#6366f1', opacity: 0.1, borderRadius: 6 }} />
                  <span style={{ position: 'relative', zIndex: 1, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 11 }}>#{i + 1}</span>
                    {mod.displayName || mod.username}
                  </span>
                  <span style={{ color: '#6366f1', position: 'relative', zIndex: 1, fontWeight: 600, fontSize: 13 }}>
                    {mod.actionCount} action{mod.actionCount !== 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action breakdown */}
      {modData.actionBreakdown.length > 0 && (
        <div style={sectionStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Action Breakdown</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {modData.actionBreakdown.map((item) => (
              <div key={item.action} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 6, padding: '6px 12px', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.action.replace(/_/g, ' ').toLowerCase()}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, marginLeft: 8 }}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function GuildInsights({ guildId }: { guildId: string }) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [range, setRange] = useState<RangeOption>(7);
  const [tab, setTab] = useState<'overview' | 'growth' | 'engagement' | 'moderation'>('overview');
  const [growth, setGrowth] = useState<GrowthData | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [channelComp, setChannelComp] = useState<ChannelComparisonData | null>(null);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [exporting, setExporting] = useState(false);

  // Load base insights
  useEffect(() => {
    api.get<InsightsData>(`/guilds/${guildId}/insights?range=${range}`).then(setData).catch(() => {});
  }, [guildId, range]);

  // Load advanced data when tab changes
  useEffect(() => {
    if (tab === 'growth' || tab === 'overview') {
      api.get<GrowthData>(`/stats/guilds/${guildId}/growth?range=${range}`).then(setGrowth).catch(() => {});
      api.get<HeatmapData>(`/stats/guilds/${guildId}/activity-heatmap?range=${range}`).then(setHeatmap).catch(() => {});
      api.get<ChannelComparisonData>(`/stats/guilds/${guildId}/channel-comparison?range=${range}`).then(setChannelComp).catch(() => {});
    }
    if (tab === 'engagement' || tab === 'overview') {
      api.get<EngagementData>(`/stats/guilds/${guildId}/engagement?range=${range}`).then(setEngagement).catch(() => {});
    }
  }, [guildId, range, tab]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const response = await fetch(`${API_BASE}/stats/guilds/${guildId}/export?range=${range}`, {
        headers: { Authorization: `Bearer ${getAccessToken() || ''}` },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `guild-stats-${guildId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent fail
    } finally {
      setExporting(false);
    }
  }, [guildId, range]);

  if (!data) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading insights...</div>;

  const sectionStyle: React.CSSProperties = {
    background: 'var(--bg-tertiary)', borderRadius: 8,
    border: '1px solid var(--stroke)', padding: 16,
  };

  const formatResponseTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const shortGrowthLabels = (growth?.labels || []).map(l => {
    const d = new Date(l);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });

  const shortEngLabels = (engagement?.labels || []).map(l => {
    const d = new Date(l);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'growth', label: 'Growth' },
    { key: 'engagement', label: 'Engagement' },
    { key: 'moderation', label: 'Moderation' },
  ];

  return (
    <div style={{ padding: 24, color: 'var(--text-primary)', maxWidth: 960, overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Server Insights</h2>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
            opacity: exporting ? 0.5 : 1,
          }}
        >
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--stroke)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: 'none', borderBottom: tab === t.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
              background: 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date range selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([7, 30, 90] as const).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${range === r ? 'var(--accent-primary)' : 'var(--stroke)'}`,
              background: range === r ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: range === r ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {r}d
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {tab === 'overview' && (
        <>
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

          {/* Messages per Day */}
          <div style={{ ...sectionStyle, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Messages per Day</h3>
            <BarChart data={data.dailyMessages} labels={data.dateLabels} color="var(--accent-primary)" />
          </div>

          {/* Member Growth line chart */}
          <div style={{ ...sectionStyle, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Daily Member Joins</h3>
            <LineChart data={data.dailyJoins} labels={data.dateLabels} color="#43b581" gradientId="joinGrad" />
          </div>

          {/* Active Hours heatmap */}
          <div style={{ ...sectionStyle, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Active Hours (Last 24h)</h3>
            <HourlyHeatmap data={data.hourlyMessages} />
          </div>

          {/* Top Channels */}
          {data.topChannels.length > 0 && (
            <div style={{ ...sectionStyle }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Top Channels ({range} days)</h3>
              <HorizontalBarChart items={data.topChannels.map(ch => ({ label: ch.name, value: ch.messages }))} />
            </div>
          )}
        </>
      )}

      {/* ===== GROWTH TAB ===== */}
      {tab === 'growth' && (
        <>
          {/* Cumulative member growth */}
          {growth && (
            <div style={{ ...sectionStyle, marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Cumulative Member Growth</h3>
              <LineChart data={growth.cumulative} labels={shortGrowthLabels} color="#6366f1" height={200} gradientId="cumulativeGrad" />
            </div>
          )}

          {/* Daily new members */}
          {growth && (
            <div style={{ ...sectionStyle, marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Daily New Members</h3>
              <BarChart data={growth.data} labels={shortGrowthLabels} color="#43b581" />
            </div>
          )}

          {/* 7x24 Activity Heatmap */}
          {heatmap && (
            <div style={{ ...sectionStyle, marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Activity Heatmap (Day x Hour)</h3>
              <ActivityHeatmapGrid {...heatmap} />
            </div>
          )}

          {/* Channel comparison */}
          {channelComp && channelComp.channels.length > 0 && (
            <div style={sectionStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Top Channels by Messages ({range}d)</h3>
              <HorizontalBarChart items={channelComp.channels.map(ch => ({ label: ch.name, value: ch.count }))} />
            </div>
          )}
        </>
      )}

      {/* ===== ENGAGEMENT TAB ===== */}
      {tab === 'engagement' && (
        <>
          {engagement && (
            <>
              {/* Engagement summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                <StatCard
                  value={engagement.activeUsers.reduce((a, b) => a + b, 0) > 0 ? Math.round(engagement.activeUsers.reduce((a, b) => a + b, 0) / engagement.activeUsers.filter(v => v > 0).length) : 0}
                  label="Avg Daily Active Users"
                  accentColor="#10b981"
                />
                <StatCard
                  value={engagement.messagesPerDay.reduce((a, b) => a + b, 0) > 0 ? Math.round(engagement.messagesPerDay.reduce((a, b) => a + b, 0) / engagement.messagesPerDay.filter(v => v > 0).length) : 0}
                  label="Avg Messages/Day"
                  accentColor="#f59e0b"
                />
                <StatCard
                  value={formatResponseTime(engagement.avgResponseSeconds)}
                  label="Avg Response Time"
                  accentColor="#6366f1"
                />
              </div>

              {/* DAU + messages trend dual chart */}
              <div style={{ ...sectionStyle, marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Daily Active Users vs Messages</h3>
                <DualLineChart
                  data1={engagement.activeUsers}
                  data2={engagement.messagesPerDay}
                  labels={shortEngLabels}
                  color1="#10b981"
                  color2="#f59e0b"
                  label1="Active Users"
                  label2="Messages"
                />
              </div>

              {/* DAU line chart */}
              <div style={{ ...sectionStyle, marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Daily Active Users</h3>
                <LineChart data={engagement.activeUsers} labels={shortEngLabels} color="#10b981" gradientId="dauGrad" />
              </div>

              {/* Messages per day */}
              <div style={sectionStyle}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Messages per Day</h3>
                <BarChart data={engagement.messagesPerDay} labels={shortEngLabels} color="#f59e0b" />
              </div>
            </>
          )}
          {!engagement && <div style={{ color: 'var(--text-muted)', padding: 24 }}>Loading engagement data...</div>}
        </>
      )}

      {/* ===== MODERATION TAB ===== */}
      {tab === 'moderation' && (
        <ModerationAnalytics guildId={guildId} range={range} />
      )}
    </div>
  );
}
