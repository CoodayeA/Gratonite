import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModerationData {
  volume: { labels: string[]; data: number[] };
  topWarned: { userId: string; username: string; displayName: string | null; warningCount: number }[];
  moderatorWorkload: { moderatorId: string; username: string; displayName: string | null; actionCount: number }[];
  funnel: { warnings: number; timeouts: number; bans: number };
  actionBreakdown: { action: string; count: number }[];
}

// ---------------------------------------------------------------------------
// SVG Line Chart
// ---------------------------------------------------------------------------

function ModLineChart({ data, labels, color, height = 160 }: { data: number[]; labels: string[]; color: string; height?: number }) {
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
        <linearGradient id="modLineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill="url(#modLineGrad)" />
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

// ---------------------------------------------------------------------------
// Funnel Visualization
// ---------------------------------------------------------------------------

function FunnelVisualization({ steps }: { steps: { label: string; value: number; color: string }[] }) {
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
// Main Component
// ---------------------------------------------------------------------------

export default function ModerationAnalytics({ guildId, range = 30 }: { guildId: string; range?: number }) {
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
    <div style={{ color: 'var(--text-primary)' }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, border: '1px solid var(--stroke)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#ef4444' }} />
          <div style={{ fontSize: 32, fontWeight: 700 }}>{totalActions.toLocaleString()}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Total Actions</div>
        </div>
        <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, border: '1px solid var(--stroke)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#f59e0b' }} />
          <div style={{ fontSize: 32, fontWeight: 700 }}>{modData.funnel.warnings.toLocaleString()}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Warnings</div>
        </div>
        <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, border: '1px solid var(--stroke)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#f97316' }} />
          <div style={{ fontSize: 32, fontWeight: 700 }}>{modData.funnel.timeouts.toLocaleString()}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Timeouts</div>
        </div>
        <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, border: '1px solid var(--stroke)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#dc2626' }} />
          <div style={{ fontSize: 32, fontWeight: 700 }}>{modData.funnel.bans.toLocaleString()}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Bans</div>
        </div>
      </div>

      {/* Mod action volume chart */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Mod Actions Over Time</h3>
        <ModLineChart data={modData.volume.data} labels={shortLabels} color="#ef4444" />
      </div>

      {/* Warning-to-Ban Funnel */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Warning to Ban Funnel</h3>
        <FunnelVisualization steps={[
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
