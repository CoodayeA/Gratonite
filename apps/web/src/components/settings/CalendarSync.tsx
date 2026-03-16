import { useState, useEffect, useCallback } from 'react';
import { Calendar, RefreshCw, Trash2, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface CalendarIntegration {
  id: string;
  guildId: string | null;
  provider: string;
  calendarId: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  createdAt: string;
}

export default function CalendarSync() {
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const { addToast } = useToast();

  const fetchIntegrations = useCallback(async () => {
    try {
      const data = await api.get('/users/@me/calendar-integrations');
      setIntegrations(data as CalendarIntegration[]);
    } catch {
      // endpoint may not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendarConnected') === 'true') {
      addToast({ title: 'Google Calendar connected!', variant: 'success' });
      const url = new URL(window.location.href);
      url.searchParams.delete('calendarConnected');
      window.history.replaceState({}, '', url.toString());
      fetchIntegrations();
    }
  }, [addToast, fetchIntegrations]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const data = await api.post('/users/@me/calendar-integrations/google/connect', {}) as { authUrl: string };
      const popup = window.open(data.authUrl, 'google-calendar-auth', 'width=600,height=700,popup=yes');
      if (!popup) window.location.href = data.authUrl;
    } catch {
      addToast({ title: 'Failed to connect Google Calendar', variant: 'error' });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await api.delete(`/users/@me/calendar-integrations/${id}`);
      setIntegrations(prev => prev.filter(i => i.id !== id));
      addToast({ title: 'Calendar disconnected', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to disconnect', variant: 'error' });
    }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      const result = await api.post(`/users/@me/calendar-integrations/${id}/sync`, {}) as { eventCount: number };
      addToast({ title: `Synced ${result.eventCount} events`, variant: 'success' });
      fetchIntegrations();
    } catch {
      addToast({ title: 'Sync failed', variant: 'error' });
    } finally {
      setSyncing(null);
    }
  };

  const handleToggleSync = async (id: string, current: boolean) => {
    try {
      const updated = await api.patch(`/users/@me/calendar-integrations/${id}`, { syncEnabled: !current }) as CalendarIntegration;
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, syncEnabled: updated.syncEnabled } : i));
    } catch {
      addToast({ title: 'Failed to update sync', variant: 'error' });
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Calendar size={18} /> Calendar Sync
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Connect your Google Calendar to sync events.
          </p>
        </div>
        <button onClick={handleConnect} disabled={connecting}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
            background: 'var(--accent-primary)', border: 'none', borderRadius: '8px',
            color: 'white', fontSize: '13px', fontWeight: 600, cursor: connecting ? 'not-allowed' : 'pointer',
            opacity: connecting ? 0.6 : 1, fontFamily: 'inherit',
          }}>
          <ExternalLink size={14} /> {connecting ? 'Connecting...' : 'Connect Google Calendar'}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : integrations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', border: '1px dashed var(--stroke)', borderRadius: '12px' }}>
          <Calendar size={40} style={{ marginBottom: '8px', opacity: 0.4 }} />
          <p style={{ margin: 0 }}>No calendars connected yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {integrations.map(i => (
            <div key={i.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={18} style={{ color: '#60a5fa' }} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{i.provider} Calendar</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Last synced: {i.lastSyncAt ? new Date(i.lastSyncAt).toLocaleString() : 'Never'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => handleToggleSync(i.id, i.syncEnabled)} title={i.syncEnabled ? 'Disable sync' : 'Enable sync'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: i.syncEnabled ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                  {i.syncEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                </button>
                <button onClick={() => handleSync(i.id)} disabled={syncing === i.id} title="Sync now"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: 'var(--text-muted)', opacity: syncing === i.id ? 0.5 : 1 }}>
                  <RefreshCw size={16} style={syncing === i.id ? { animation: 'spin 1s linear infinite' } : undefined} />
                </button>
                <button onClick={() => handleDisconnect(i.id)} title="Disconnect"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#ef4444' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
