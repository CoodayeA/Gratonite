import { useState, useEffect } from 'react';
import { Monitor, Smartphone, Globe, Shield, Trash2, LogOut, Fingerprint } from 'lucide-react';
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

interface KnownDevice {
  id: string;
  ip: string;
  device: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

function parseOS(ua: string): string {
  const lower = ua.toLowerCase();
  if (lower.includes('windows nt 10')) return 'Windows';
  if (lower.includes('windows')) return 'Windows';
  if (lower.includes('mac os x') || lower.includes('macintosh')) return 'macOS';
  if (lower.includes('android')) return 'Android';
  if (lower.includes('iphone') || lower.includes('ipad')) return 'iOS';
  if (lower.includes('linux')) return 'Linux';
  if (lower.includes('cros')) return 'ChromeOS';
  return '';
}

function parseBrowser(ua: string): string {
  const lower = ua.toLowerCase();
  // Order matters — Edge contains "chrome", Chrome contains "safari"
  if (lower.includes('edg/') || lower.includes('edge/')) return 'Edge';
  if (lower.includes('opr/') || lower.includes('opera')) return 'Opera';
  if (lower.includes('brave')) return 'Brave';
  if (lower.includes('vivaldi')) return 'Vivaldi';
  if (lower.includes('firefox')) return 'Firefox';
  if (lower.includes('chrome') || lower.includes('chromium')) return 'Chrome';
  if (lower.includes('safari')) return 'Safari';
  return '';
}

function parseDevice(ua: string | null): { icon: typeof Monitor; label: string } {
  if (!ua) return { icon: Monitor, label: 'Unknown Device' };
  const lower = ua.toLowerCase();
  const isMobile = lower.includes('mobile') || lower.includes('android') || lower.includes('iphone') || lower.includes('ipad');
  const os = parseOS(ua);
  const browser = parseBrowser(ua);
  const parts = [browser, os ? `on ${os}` : ''].filter(Boolean).join(' ');
  if (isMobile) {
    return { icon: Smartphone, label: parts || 'Mobile Device' };
  }
  return { icon: Monitor, label: parts || 'Desktop Browser' };
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
  const [knownDevices, setKnownDevices] = useState<KnownDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [removingDevice, setRemovingDevice] = useState<string | null>(null);
  const [tab, setTab] = useState<'sessions' | 'devices'>('sessions');

  useEffect(() => {
    Promise.all([
      api.users.getSessions().catch(() => []),
      api.auth.getKnownDevices().catch(() => []),
    ]).then(([sessData, devData]) => {
      setSessions(Array.isArray(sessData) ? sessData : []);
      setKnownDevices(Array.isArray(devData) ? devData : []);
    }).finally(() => setLoading(false));
  }, []);

  const revokeSession = async (id: string) => {
    setRevoking(id);
    try {
      await api.users.revokeSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch { /* ignore */ }
    setRevoking(null);
  };

  const revokeAllOtherSessions = async () => {
    setRevokingAll(true);
    try {
      await api.users.revokeAllOtherSessions();
      setSessions(prev => prev.filter(s => s.current));
    } catch { /* ignore */ }
    setRevokingAll(false);
  };

  const removeDevice = async (id: string) => {
    setRemovingDevice(id);
    try {
      await api.auth.removeKnownDevice(id);
      setKnownDevices(prev => prev.filter(d => d.id !== id));
    } catch { /* ignore */ }
    setRemovingDevice(null);
  };

  if (loading) {
    return <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '20px' }}>Loading sessions...</p>;
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <Shield size={20} color="var(--accent-primary)" />
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Login History & Devices</h3>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
            Active sessions and recognized devices. You'll receive an email alert when logging in from a new device.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '3px' }}>
        <button
          onClick={() => setTab('sessions')}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600,
            background: tab === 'sessions' ? 'var(--accent-primary)' : 'transparent',
            color: tab === 'sessions' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          Active Sessions ({sessions.length})
        </button>
        <button
          onClick={() => setTab('devices')}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600,
            background: tab === 'devices' ? 'var(--accent-primary)' : 'transparent',
            color: tab === 'devices' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          Known Devices ({knownDevices.length})
        </button>
      </div>

      {tab === 'sessions' && (
        <>
          {sessions.length > 1 && (
            <button
              onClick={revokeAllOtherSessions}
              disabled={revokingAll}
              style={{
                width: '100%', marginBottom: '12px', padding: '10px',
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px', cursor: 'pointer', color: '#ef4444',
                fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '6px', opacity: revokingAll ? 0.5 : 1,
              }}
            >
              <LogOut size={14} /> Sign Out All Other Sessions
            </button>
          )}

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
        </>
      )}

      {tab === 'devices' && (
        <>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            These are devices that have previously logged into your account. Removing a device means you'll get an email alert next time it logs in.
          </p>
          {knownDevices.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No known devices recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {knownDevices.map(device => (
                <div key={device.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.06)',
                  }}>
                    <Fingerprint size={18} color="var(--text-secondary)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {device.device}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Globe size={10} /> {device.ip}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Last seen {timeAgo(device.lastSeenAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeDevice(device.id)}
                    disabled={removingDevice === device.id}
                    title="Remove Device"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '6px', padding: '6px 10px', cursor: 'pointer',
                      color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px',
                      fontSize: '11px', fontWeight: 600, opacity: removingDevice === device.id ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
