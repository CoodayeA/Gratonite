import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, MessageSquare, Hash, Zap, Calendar, ArrowLeft, Wifi, Code, Image, Copy, Check } from 'lucide-react';
import { api, API_BASE } from '../../lib/api';
import { copyToClipboard } from '../../utils/clipboard';

interface GuildStats {
  guild: {
    id: string;
    name: string;
    iconHash: string | null;
    bannerHash: string | null;
    description: string | null;
    createdAt: string;
  };
  memberCount: number;
  onlineCount: number;
  messagesToday: number;
  messagesThisWeek: number;
  channelsCount: number;
  boostCount: number;
  boostTier: number;
  activity: Array<{ date: string; messages: number }>;
}

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number | string; label: string; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      border: '1px solid var(--stroke)',
      borderRadius: '12px',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
      minWidth: 0,
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ color, flexShrink: 0 }}>{icon}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function ActivityChart({ activity }: { activity: Array<{ date: string; messages: number }> }) {
  const maxMessages = useMemo(() => Math.max(...activity.map(a => a.messages), 1), [activity]);
  const chartHeight = 200;
  const chartWidth = 600;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const plotW = chartWidth - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;

  const points = activity.map((a, i) => {
    const x = padding.left + (i / (activity.length - 1)) * plotW;
    const y = padding.top + plotH - (a.messages / maxMessages) * plotH;
    return { x, y, ...a };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = pathD + ` L ${points[points.length - 1].x.toFixed(1)} ${(padding.top + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padding.top + plotH).toFixed(1)} Z`;

  // Y-axis labels
  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxMessages / yTicks) * i));

  return (
    <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>Message Activity (Last 30 Days)</h3>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 'auto', maxHeight: '250px' }}>
        {/* Grid lines */}
        {yLabels.map((val, i) => {
          const y = padding.top + plotH - (val / maxMessages) * plotH;
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="var(--stroke)" strokeWidth="0.5" strokeDasharray="4 2" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10">{val}</text>
            </g>
          );
        })}

        {/* Area fill */}
        <defs>
          <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#activityGrad)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)" stroke="var(--bg-tertiary)" strokeWidth="1.5">
            <title>{p.date}: {p.messages} messages</title>
          </circle>
        ))}

        {/* X-axis labels (every 7 days) */}
        {points.filter((_, i) => i % 7 === 0 || i === points.length - 1).map((p, i) => (
          <text key={i} x={p.x} y={chartHeight - 5} textAnchor="middle" fill="var(--text-muted)" fontSize="9">
            {new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default function PublicGuildStats() {
  const { guildId } = useParams<{ guildId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<GuildStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedBadge, setCopiedBadge] = useState(false);

  useEffect(() => {
    if (!guildId) return;
    setLoading(true);
    api.guilds.getPublicStats(guildId)
      .then(setData)
      .catch((err: any) => {
        if (err?.status === 403) setError('Public stats are not enabled for this server.');
        else if (err?.status === 404) setError('Server not found.');
        else setError('Failed to load stats.');
      })
      .finally(() => setLoading(false));
  }, [guildId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '40px' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading stats...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '40px', gap: '16px' }}>
        <div style={{ fontSize: '48px', opacity: 0.3 }}>:/</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>{error || 'Something went wrong.'}</div>
        <button onClick={() => navigate(-1)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Go Back</button>
      </div>
    );
  }

  const guildAge = Math.floor((Date.now() - new Date(data.guild.createdAt).getTime()) / 86400000);
  const iconUrl = data.guild.iconHash ? `${API_BASE.replace('/api/v1', '')}/uploads/icons/${data.guild.iconHash}` : null;
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const statsPageUrl = `${appOrigin}/app/guild/${data.guild.id}/stats`;
  const embedCode = `<iframe src="${statsPageUrl}?embed=1" width="400" height="300" frameborder="0" style="border-radius:12px;border:1px solid #333"></iframe>`;
  const badgeUrl = `${API_BASE}/stats/guilds/${data.guild.id}/badge`;

  const handleCopy = (text: string, setter: (v: boolean) => void) => {
    copyToClipboard(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  };

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}>
          <ArrowLeft size={20} />
        </button>
        {iconUrl && (
          <img
            src={iconUrl}
            alt={data.guild.name}
            style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover' }}
          />
        )}
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{data.guild.name}</h1>
          {data.guild.description && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>{data.guild.description}</p>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '20px',
      }}>
        <StatCard icon={<Users size={18} />} value={data.memberCount} label="Members" color="#5865f2" />
        <StatCard icon={<Wifi size={18} />} value={data.onlineCount} label="Online Now" color="#57f287" />
        <StatCard icon={<MessageSquare size={18} />} value={data.messagesToday} label="Messages Today" color="#fee75c" />
        <StatCard icon={<MessageSquare size={18} />} value={data.messagesThisWeek} label="Messages This Week" color="#eb459e" />
        <StatCard icon={<Hash size={18} />} value={data.channelsCount} label="Channels" color="#ed4245" />
        <StatCard icon={<Zap size={18} />} value={data.boostCount} label={`Boosts (Tier ${data.boostTier})`} color="#f47fff" />
        <StatCard icon={<Calendar size={18} />} value={`${guildAge}d`} label="Portal Age" color="#5865f2" />
      </div>

      {/* Activity Chart */}
      {data.activity.length > 0 && <ActivityChart activity={data.activity} />}

      {/* Embeddable Widget Section */}
      <div style={{ marginTop: '20px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Code size={16} /> Embed This Widget
        </h3>

        {/* Iframe embed */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>Iframe Embed Code</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
            <code style={{
              flex: 1,
              background: 'var(--bg-primary)',
              border: '1px solid var(--stroke)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              display: 'block',
            }}>
              {embedCode}
            </code>
            <button
              onClick={() => handleCopy(embedCode, setCopiedEmbed)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: copiedEmbed ? 'var(--success)' : 'var(--accent)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0,
              }}
            >
              {copiedEmbed ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
        </div>

        {/* Badge URL */}
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Image size={14} /> Badge URL
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
            <code style={{
              flex: 1,
              background: 'var(--bg-primary)',
              border: '1px solid var(--stroke)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              display: 'block',
            }}>
              {badgeUrl}
            </code>
            <button
              onClick={() => handleCopy(badgeUrl, setCopiedBadge)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: copiedBadge ? 'var(--success)' : 'var(--accent)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0,
              }}
            >
              {copiedBadge ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '20px', padding: '12px', color: 'var(--text-muted)', fontSize: '11px' }}>
        Stats refresh every 2 minutes
      </div>
    </div>
  );
}
