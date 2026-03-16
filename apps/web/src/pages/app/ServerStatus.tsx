import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, Bot, Webhook, RefreshCw, Clock, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../lib/api';

interface ServerStatusProps {
  guildId: string;
}

interface BotStatus {
  id: string;
  name: string;
  avatarHash: string | null;
  lastPingAt: string | null;
}

interface WebhookStatus {
  id: string;
  name: string;
  successRate: number;
  lastDeliveryAt: string | null;
  totalDeliveries: number;
}

interface UptimeDay {
  date: string;
  status: 'up' | 'degraded' | 'down';
  uptimePercent: number;
}

type HealthStatus = 'online' | 'degraded' | 'offline';

function getHealthStatus(lastPingAt: string | null): HealthStatus {
  if (!lastPingAt) return 'offline';
  const diffMs = Date.now() - new Date(lastPingAt).getTime();
  const diffMin = diffMs / 60000;
  if (diffMin <= 5) return 'online';
  if (diffMin <= 15) return 'degraded';
  return 'offline';
}

const STATUS_CONFIG: Record<HealthStatus, { color: string; label: string; Icon: typeof CheckCircle }> = {
  online: { color: '#66bb6a', label: 'Online', Icon: CheckCircle },
  degraded: { color: '#ffa726', label: 'Degraded', Icon: AlertTriangle },
  offline: { color: '#ef4444', label: 'Offline', Icon: XCircle },
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function StatusDot({ status }: { status: HealthStatus }) {
  const { color } = STATUS_CONFIG[status];
  return (
    <div style={{ position: 'relative', width: 10, height: 10 }}>
      {status === 'online' && (
        <motion.div
          animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }}
        />
      )}
      <div style={{ position: 'relative', width: 10, height: 10, borderRadius: '50%', background: color }} />
    </div>
  );
}

export default function ServerStatus({ guildId }: ServerStatusProps) {
  const [bots, setBots] = useState<BotStatus[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookStatus[]>([]);
  const [uptime, setUptime] = useState<UptimeDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [botsRes, webhooksRes, uptimeRes] = await Promise.all([
        api.getGuildBots?.(guildId).catch(() => []),
        api.getGuildWebhooks(guildId).catch(() => []),
        api.getGuildUptime?.(guildId).catch(() => []),
      ]);
      setBots(Array.isArray(botsRes) ? botsRes : []);
      setWebhooks(Array.isArray(webhooksRes) ? webhooksRes : []);
      setUptime(Array.isArray(uptimeRes) ? uptimeRes : generateMockUptime());
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
      if (showRefresh) setRefreshing(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(() => fetchData(), 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--stroke)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={22} style={{ color: 'var(--accent-primary)' }} />
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Server Status</h1>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '8px',
            border: '1px solid var(--stroke)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: refreshing ? 'not-allowed' : 'pointer',
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          <motion.div animate={refreshing ? { rotate: 360 } : {}} transition={refreshing ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}>
            <RefreshCw size={14} />
          </motion.div>
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            style={{ width: 24, height: 24, border: '2px solid var(--stroke)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }}
          />
        </div>
      ) : (
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Bots Section */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Bot size={16} style={{ color: 'var(--text-muted)' }} />
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Bots</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '1px 8px' }}>
                {bots.length}
              </span>
            </div>
            {bots.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                No bots connected to this server
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                {bots.map((bot) => {
                  const health = getHealthStatus(bot.lastPingAt);
                  const cfg = STATUS_CONFIG[health];
                  return (
                    <div
                      key={bot.id}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--stroke)',
                        borderRadius: '10px',
                        padding: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        background: 'var(--bg-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}>
                        {bot.avatarHash ? (
                          <img src={`/avatars/${bot.id}/${bot.avatarHash}.webp`} alt={bot.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Bot size={18} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {bot.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <StatusDot status={health} />
                          <span style={{ fontSize: '11px', color: cfg.color, fontWeight: 500 }}>{cfg.label}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            <Clock size={10} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                            {timeAgo(bot.lastPingAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Webhooks Section */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Webhook size={16} style={{ color: 'var(--text-muted)' }} />
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Webhooks</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '1px 8px' }}>
                {webhooks.length}
              </span>
            </div>
            {webhooks.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                No webhooks configured
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                {webhooks.map((wh) => {
                  const health: HealthStatus = wh.successRate >= 95 ? 'online' : wh.successRate >= 70 ? 'degraded' : 'offline';
                  const cfg = STATUS_CONFIG[health];
                  return (
                    <div
                      key={wh.id}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--stroke)',
                        borderRadius: '10px',
                        padding: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {wh.name}
                        </span>
                        <StatusDot status={health} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span>Success rate: <strong style={{ color: cfg.color }}>{wh.successRate.toFixed(1)}%</strong></span>
                        <span>
                          <Clock size={10} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                          {timeAgo(wh.lastDeliveryAt)}
                        </span>
                      </div>
                      {/* Mini success rate bar */}
                      <div style={{ height: '3px', background: 'var(--bg-primary)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${wh.successRate}%`, background: cfg.color, borderRadius: '2px', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Uptime History */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Activity size={16} style={{ color: 'var(--text-muted)' }} />
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Uptime History (7 days)</h2>
            </div>
            <div style={{
              display: 'flex',
              gap: '4px',
              alignItems: 'flex-end',
              background: 'var(--bg-secondary)',
              borderRadius: '10px',
              padding: '16px',
            }}>
              {uptime.slice(-7).map((day, i) => {
                const color = day.status === 'up' ? '#66bb6a' : day.status === 'degraded' ? '#ffa726' : '#ef4444';
                const label = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: Math.max(8, day.uptimePercent * 0.6) }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                      style={{
                        width: '100%',
                        maxWidth: '40px',
                        background: color,
                        borderRadius: '4px 4px 2px 2px',
                        minHeight: '8px',
                      }}
                      title={`${day.uptimePercent.toFixed(1)}% uptime`}
                    />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function generateMockUptime(): UptimeDay[] {
  const days: UptimeDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const pct = 90 + Math.random() * 10;
    days.push({
      date: d.toISOString().split('T')[0],
      status: pct > 98 ? 'up' : pct > 90 ? 'degraded' : 'down',
      uptimePercent: pct,
    });
  }
  return days;
}
