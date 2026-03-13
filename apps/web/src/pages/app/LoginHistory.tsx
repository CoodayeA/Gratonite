import { useState, useEffect } from 'react';
import { Monitor, Smartphone, Globe, AlertTriangle, Shield, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';

interface SessionEntry {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  createdAt: string;
  current?: boolean;
}

function parseDevice(ua: string | null): { icon: typeof Monitor; label: string } {
  if (!ua) return { icon: Monitor, label: 'Unknown Device' };
  const lower = ua.toLowerCase();
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) {
    return { icon: Smartphone, label: 'Mobile Device' };
  }
  if (lower.includes('chrome')) return { icon: Monitor, label: 'Chrome' };
  if (lower.includes('firefox')) return { icon: Monitor, label: 'Firefox' };
  if (lower.includes('safari')) return { icon: Monitor, label: 'Safari' };
  if (lower.includes('edge')) return { icon: Monitor, label: 'Edge' };
  return { icon: Monitor, label: 'Desktop Browser' };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function LoginHistory() {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    api.users.getSessions()
      .then((data: any) => setSessions(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Failed to load sessions:', err))
      .finally(() => setLoading(false));
  }, []);

  const revokeSession = async (id: string) => {
    setRevoking(id);
    try {
      await api.users.revokeSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch { /* ignore */ }
    setRevoking(null);
  };

  if (loading) {
    return <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '20px' }}>Loading sessions...</p>;
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <Shield size={20} color="var(--accent-primary)" />
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Login History</h3>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
            Active sessions and recent login activity
          </p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No active sessions found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sessions.map(session => {
            const device = parseDevice(session.userAgent || session.deviceName);
            const DeviceIcon = device.icon;
            return (
              <div key={session.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px', borderRadius: '10px',
                background: session.current ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${session.current ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.06)',
                }}>
                  <DeviceIcon size={18} color="var(--text-secondary)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {session.deviceName || device.label}
                    </span>
                    {session.current && (
                      <span style={{
                        fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                        background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontWeight: 600,
                      }}>
                        Current
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    {session.ipAddress && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Globe size={10} /> {session.ipAddress}
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Active {timeAgo(session.lastActiveAt || session.createdAt)}
                    </span>
                  </div>
                </div>
                {!session.current && (
                  <button
                    onClick={() => revokeSession(session.id)}
                    disabled={revoking === session.id}
                    title="Revoke Session"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '6px', padding: '6px 10px', cursor: 'pointer',
                      color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px',
                      fontSize: '11px', fontWeight: 600, opacity: revoking === session.id ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={12} /> Revoke
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
