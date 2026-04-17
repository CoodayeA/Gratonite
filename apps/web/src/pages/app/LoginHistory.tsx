import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { Monitor, Smartphone, Globe, Shield, Trash2, LogOut, Fingerprint, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';

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
  if (!ua) return { icon: Monitor, label: 'Unknown device' };
  const lower = ua.toLowerCase();
  const isMobile = lower.includes('mobile') || lower.includes('android') || lower.includes('iphone') || lower.includes('ipad');
  const os = parseOS(ua);
  const browser = parseBrowser(ua);
  const parts = [browser, os ? `on ${os}` : ''].filter(Boolean).join(' ');
  if (isMobile) {
    return { icon: Smartphone, label: parts || 'Mobile device' };
  }
  return { icon: Monitor, label: parts || 'Desktop browser' };
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

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const cardStyle: CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--stroke)',
  borderRadius: 'var(--radius-lg)',
};

const secondaryTextStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-muted)',
  lineHeight: 1.5,
};

export default function LoginHistory() {
  const { addToast } = useToast();
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [knownDevices, setKnownDevices] = useState<KnownDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [partialWarning, setPartialWarning] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [removingDevice, setRemovingDevice] = useState<string | null>(null);
  const [tab, setTab] = useState<'sessions' | 'devices'>('sessions');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setPartialWarning(null);

    const [sessionsResult, devicesResult] = await Promise.allSettled([
      api.users.getSessions(),
      api.auth.getKnownDevices(),
    ]);

    const nextWarnings: string[] = [];

    if (sessionsResult.status === 'fulfilled') {
      setSessions(Array.isArray(sessionsResult.value) ? sessionsResult.value : []);
    } else {
      setSessions([]);
      nextWarnings.push('sessions');
    }

    if (devicesResult.status === 'fulfilled') {
      setKnownDevices(Array.isArray(devicesResult.value) ? devicesResult.value : []);
    } else {
      setKnownDevices([]);
      nextWarnings.push('devices');
    }

    if (nextWarnings.length === 2) {
      setLoadError('We could not load your sessions or device history right now.');
    } else if (nextWarnings.length === 1) {
      setPartialWarning(`We could not load your ${nextWarnings[0]} right now, but the rest of this view is still available.`);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const currentSession = useMemo(
    () => sessions.find((session) => session.current) ?? null,
    [sessions],
  );

  const otherSessions = useMemo(
    () => sessions.filter((session) => !session.current),
    [sessions],
  );

  const revokeSession = async (id: string) => {
    setRevoking(id);
    try {
      await api.users.revokeSession(id);
      setSessions((prev) => prev.filter((session) => session.id !== id));
      addToast({ title: 'Session removed', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to revoke session', variant: 'error' });
    }
    setRevoking(null);
  };

  const revokeAllOtherSessions = async () => {
    setRevokingAll(true);
    try {
      await api.users.revokeAllOtherSessions();
      setSessions((prev) => prev.filter((session) => session.current));
      addToast({ title: 'Other sessions signed out', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to sign out other sessions', variant: 'error' });
    }
    setRevokingAll(false);
  };

  const removeDevice = async (id: string) => {
    setRemovingDevice(id);
    try {
      await api.auth.removeKnownDevice(id);
      setKnownDevices((prev) => prev.filter((device) => device.id !== id));
      addToast({ title: 'Known device removed', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to remove device', variant: 'error' });
    }
    setRemovingDevice(null);
  };

  const renderSkeletons = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          style={{
            ...cardStyle,
            padding: '16px',
            opacity: 0.7,
          }}
        >
          <div style={{ width: '40%', height: '12px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', marginBottom: '10px' }} />
          <div style={{ width: '70%', height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', marginBottom: '8px' }} />
          <div style={{ width: '55%', height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)' }} />
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              flexShrink: 0,
            }}
          >
            <Shield size={18} color="var(--accent-primary)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Sessions & devices
            </h3>
            <p style={{ ...secondaryTextStyle, marginTop: '4px' }}>
              Review where your account is active, remove old sessions, and keep a cleaner eye on trusted devices.
            </p>
          </div>
        </div>
        <button
          onClick={() => void loadData()}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--stroke)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        <div style={{ ...cardStyle, padding: '14px 16px' }}>
          <div style={{ ...secondaryTextStyle, marginBottom: '6px' }}>Active sessions</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>{sessions.length}</div>
        </div>
        <div style={{ ...cardStyle, padding: '14px 16px' }}>
          <div style={{ ...secondaryTextStyle, marginBottom: '6px' }}>Known devices</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>{knownDevices.length}</div>
        </div>
        <div style={{ ...cardStyle, padding: '14px 16px' }}>
          <div style={{ ...secondaryTextStyle, marginBottom: '6px' }}>Current session</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {currentSession ? timeAgo(currentSession.lastActiveAt || currentSession.createdAt) : 'Unavailable'}
          </div>
        </div>
      </div>

      {loadError && (
        <div
          style={{
            ...cardStyle,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            borderColor: 'rgba(248, 113, 113, 0.25)',
            background: 'rgba(127, 29, 29, 0.16)',
          }}
        >
          <AlertTriangle size={16} color="#f87171" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Could not load this view
            </div>
            <div style={secondaryTextStyle}>{loadError}</div>
          </div>
        </div>
      )}

      {partialWarning && !loadError && (
        <div
          style={{
            ...cardStyle,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            borderColor: 'rgba(245, 158, 11, 0.25)',
            background: 'rgba(120, 53, 15, 0.14)',
          }}
        >
          <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={secondaryTextStyle}>{partialWarning}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-lg)', padding: '4px' }}>
        <button
          onClick={() => setTab('sessions')}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 700,
            background: tab === 'sessions' ? 'var(--accent-primary)' : 'transparent',
            color: tab === 'sessions' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          Sessions
        </button>
        <button
          onClick={() => setTab('devices')}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 700,
            background: tab === 'devices' ? 'var(--accent-primary)' : 'transparent',
            color: tab === 'devices' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          Devices
        </button>
      </div>

      {loading ? (
        renderSkeletons()
      ) : tab === 'sessions' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {currentSession && (
            <div style={{ ...cardStyle, padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Current session
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {currentSession.deviceName || parseDevice(currentSession.userAgent).label}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 8px',
                    borderRadius: '999px',
                    color: '#22c55e',
                    background: 'rgba(34, 197, 94, 0.14)',
                  }}
                >
                  Active now
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div>
                  <div style={secondaryTextStyle}>Last active</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '4px' }}>
                    {formatDateTime(currentSession.lastActiveAt || currentSession.createdAt)}
                  </div>
                </div>
                <div>
                  <div style={secondaryTextStyle}>IP address</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '4px' }}>
                    {currentSession.ipAddress || 'Unavailable'}
                  </div>
                </div>
                <div>
                  <div style={secondaryTextStyle}>Signed in</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '4px' }}>
                    {formatDateTime(currentSession.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {otherSessions.length > 0 && (
            <button
              onClick={revokeAllOtherSessions}
              disabled={revokingAll}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                color: '#ef4444',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                opacity: revokingAll ? 0.5 : 1,
              }}
            >
              <LogOut size={14} /> Sign out other sessions
            </button>
          )}

          {otherSessions.length === 0 ? (
            <div style={{ ...cardStyle, padding: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                No other sessions
              </div>
              <div style={secondaryTextStyle}>
                You do not currently have any other active sessions to review.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {otherSessions.map((session) => {
                const device = parseDevice(session.userAgent || session.deviceName);
                const DeviceIcon = device.icon;
                return (
                  <div key={session.id} style={{ ...cardStyle, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255,255,255,0.05)',
                        flexShrink: 0,
                      }}
                    >
                      <DeviceIcon size={18} color="var(--text-secondary)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {session.deviceName || device.label}
                      </div>
                      <div style={{ ...secondaryTextStyle, marginTop: '4px' }}>
                        Active {timeAgo(session.lastActiveAt || session.createdAt)} from {session.ipAddress || 'an unknown IP'}
                      </div>
                      <div style={{ ...secondaryTextStyle, marginTop: '6px' }}>
                        Signed in {formatDateTime(session.createdAt)}
                      </div>
                    </div>
                    <button
                      onClick={() => void revokeSession(session.id)}
                      disabled={revoking === session.id}
                      title="Revoke session"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: 'var(--radius-md)',
                        padding: '8px 10px',
                        cursor: 'pointer',
                        color: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        opacity: revoking === session.id ? 0.5 : 1,
                      }}
                    >
                      <Trash2 size={12} /> Revoke
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : knownDevices.length === 0 ? (
        <div style={{ ...cardStyle, padding: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            No known devices yet
          </div>
          <div style={secondaryTextStyle}>
            Devices that sign in successfully will start appearing here so you can review or remove them later.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {knownDevices.map((device) => (
            <div key={device.id} style={{ ...cardStyle, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.05)',
                  flexShrink: 0,
                }}
              >
                <Fingerprint size={18} color="var(--text-secondary)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {device.device || 'Recognized device'}
                </div>
                <div style={{ ...secondaryTextStyle, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Globe size={11} /> {device.ip}
                  </span>
                  <span>First seen {timeAgo(device.firstSeenAt)}</span>
                  <span>Last seen {timeAgo(device.lastSeenAt)}</span>
                </div>
                <div style={{ ...secondaryTextStyle, marginTop: '6px' }}>
                  Last activity: {formatDateTime(device.lastSeenAt)}
                </div>
              </div>
              <button
                onClick={() => void removeDevice(device.id)}
                disabled={removingDevice === device.id}
                title="Remove known device"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  opacity: removingDevice === device.id ? 0.5 : 1,
                }}
              >
                <Trash2 size={12} /> Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
