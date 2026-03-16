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
  const toast = useToast();

  const fetchIntegrations = useCallback(async () => {
    try {
      const data = await api.get('/users/@me/calendar-integrations');
      setIntegrations(data as CalendarIntegration[]);
    } catch (err) {
      console.error('Failed to fetch calendar integrations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // Check URL for calendarConnected param (after OAuth redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendarConnected') === 'true') {
      toast.success('Google Calendar connected successfully!');
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('calendarConnected');
      window.history.replaceState({}, '', url.toString());
      fetchIntegrations();
    }
  }, [toast, fetchIntegrations]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const data = await api.post('/users/@me/calendar-integrations/google/connect', {}) as { authUrl: string };
      // Open Google OAuth in popup
      const popup = window.open(data.authUrl, 'google-calendar-auth', 'width=600,height=700,popup=yes');
      if (!popup) {
        // Fallback: redirect in same window
        window.location.href = data.authUrl;
      }
    } catch (err) {
      toast.error('Failed to initiate Google Calendar connection');
      console.error(err);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await api.delete(`/users/@me/calendar-integrations/${id}`);
      setIntegrations(prev => prev.filter(i => i.id !== id));
      toast.success('Calendar disconnected');
    } catch (err) {
      toast.error('Failed to disconnect calendar');
      console.error(err);
    }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      const result = await api.post(`/users/@me/calendar-integrations/${id}/sync`, {}) as { eventCount: number };
      toast.success(`Synced ${result.eventCount} events`);
      fetchIntegrations();
    } catch (err) {
      toast.error('Sync failed');
      console.error(err);
    } finally {
      setSyncing(null);
    }
  };

  const handleToggleSync = async (id: string, currentState: boolean) => {
    try {
      const updated = await api.patch(`/users/@me/calendar-integrations/${id}`, { syncEnabled: !currentState }) as CalendarIntegration;
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, syncEnabled: updated.syncEnabled } : i));
    } catch (err) {
      toast.error('Failed to update sync setting');
      console.error(err);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Calendar Sync
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Connect your Google Calendar to sync events with Gratonite.
          </p>
        </div>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          {connecting ? 'Connecting...' : 'Connect Google Calendar'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading integrations...</div>
      ) : integrations.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border border-dashed border-gray-700 rounded-lg">
          <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No calendars connected yet.</p>
          <p className="text-xs mt-1">Connect your Google Calendar to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map(integration => (
            <div
              key={integration.id}
              className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-white font-medium capitalize">
                    {integration.provider} Calendar
                  </div>
                  <div className="text-xs text-gray-400">
                    Calendar: {integration.calendarId} &middot; Last synced: {formatDate(integration.lastSyncAt)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Toggle sync */}
                <button
                  onClick={() => handleToggleSync(integration.id, integration.syncEnabled)}
                  className="p-2 rounded-md hover:bg-gray-700 transition-colors"
                  title={integration.syncEnabled ? 'Disable auto-sync' : 'Enable auto-sync'}
                >
                  {integration.syncEnabled ? (
                    <ToggleRight className="w-5 h-5 text-green-400" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-gray-500" />
                  )}
                </button>

                {/* Manual sync */}
                <button
                  onClick={() => handleSync(integration.id)}
                  disabled={syncing === integration.id}
                  className="p-2 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
                  title="Sync now"
                >
                  <RefreshCw className={`w-5 h-5 text-gray-400 ${syncing === integration.id ? 'animate-spin' : ''}`} />
                </button>

                {/* Disconnect */}
                <button
                  onClick={() => handleDisconnect(integration.id)}
                  className="p-2 rounded-md hover:bg-red-900/30 transition-colors"
                  title="Disconnect"
                >
                  <Trash2 className="w-5 h-5 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
