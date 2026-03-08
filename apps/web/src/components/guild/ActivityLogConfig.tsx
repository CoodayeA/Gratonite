import { useState, useEffect, useCallback } from 'react';
import { ScrollText, Save } from 'lucide-react';
import { API_BASE } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface Channel {
  id: string;
  name: string;
}

const ALL_EVENTS = [
  { key: 'member_join', label: 'Member Join' },
  { key: 'member_leave', label: 'Member Leave' },
  { key: 'ban', label: 'Ban' },
  { key: 'unban', label: 'Unban' },
  { key: 'role_change', label: 'Role Change' },
  { key: 'channel_create', label: 'Channel Create' },
  { key: 'channel_delete', label: 'Channel Delete' },
  { key: 'message_delete', label: 'Message Delete' },
];

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('gratonite_access_token') ?? ''}`,
  'Content-Type': 'application/json',
});

export default function ActivityLogConfig({ guildId, channels }: {
  guildId: string;
  channels: Channel[];
}) {
  const { addToast } = useToast();
  const [channelId, setChannelId] = useState('');
  const [enabledEvents, setEnabledEvents] = useState<string[]>(ALL_EVENTS.map(e => e.key));
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/log-config`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.channelId) setChannelId(data.channelId);
        if (Array.isArray(data.events)) setEnabledEvents(data.events);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [guildId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const toggleEvent = (key: string) => {
    setEnabledEvents(prev =>
      prev.includes(key) ? prev.filter(e => e !== key) : [...prev, key]
    );
  };

  const save = async () => {
    if (!channelId) {
      addToast('Please select a log channel', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/log-config`, {
        method: 'PUT',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({ channelId, events: enabledEvents }),
      });
      if (res.ok) addToast('Activity log config saved', 'success');
      else addToast('Failed to save config', 'error');
    } catch { addToast('Failed to save', 'error'); }
  };

  if (loading) return <div className="text-gray-400 p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <ScrollText className="w-5 h-5" /> Activity Log
        </h3>
        <button onClick={save} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm">
          <Save className="w-4 h-4" /> Save
        </button>
      </div>

      <div>
        <label className="text-sm text-gray-400 mb-1 block">Log Channel</label>
        <select
          value={channelId}
          onChange={e => setChannelId(e.target.value)}
          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
        >
          <option value="">Select a channel</option>
          {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
        </select>
      </div>

      <div>
        <label className="text-sm text-gray-400 mb-2 block">Events to Log</label>
        <div className="grid grid-cols-2 gap-2">
          {ALL_EVENTS.map(evt => (
            <label key={evt.key} className="flex items-center gap-2 p-2 bg-gray-900 rounded border border-gray-700 cursor-pointer hover:border-gray-600">
              <input
                type="checkbox"
                checked={enabledEvents.includes(evt.key)}
                onChange={() => toggleEvent(evt.key)}
                className="rounded border-gray-600 bg-gray-800 text-indigo-500"
              />
              <span className="text-sm text-gray-300">{evt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
