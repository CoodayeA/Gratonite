import { useState, useEffect, useCallback } from 'react';
import { Newspaper, Save, Eye, Calendar, ChevronDown } from 'lucide-react';
import { API_BASE } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface Channel {
  id: string;
  name: string;
}

interface DigestPreview {
  topMessages: Array<{ messageId: string; content: string | null; reactionCount: number }>;
  newMembers: Array<{ userId: string; displayName: string; username: string }>;
  messageCount: number;
  activeChannels: Array<{ channelName: string; messageCount: number }>;
  activeMembers: Array<{ displayName: string | null; username: string | null; messageCount: number }>;
}

interface PastDigest {
  id: string;
  weekStart: string;
  content: DigestPreview;
  createdAt: string;
}

const ALL_SECTIONS = [
  { key: 'top_messages', label: 'Top Messages' },
  { key: 'new_members', label: 'New Members' },
  { key: 'message_count', label: 'Message Count' },
  { key: 'active_channels', label: 'Active Channels' },
  { key: 'active_members', label: 'Active Members' },
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('gratonite_access_token') ?? ''}`,
  'Content-Type': 'application/json',
});

export default function DigestConfig({ guildId, channels }: {
  guildId: string;
  channels: Channel[];
}) {
  const { addToast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [targetChannelId, setTargetChannelId] = useState('');
  const [sections, setSections] = useState<string[]>(ALL_SECTIONS.map(s => s.key));
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [preview, setPreview] = useState<DigestPreview | null>(null);
  const [pastDigests, setPastDigests] = useState<PastDigest[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/digest/config`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setEnabled(data.enabled || false);
        if (data.targetChannelId) setTargetChannelId(data.targetChannelId);
        if (Array.isArray(data.sections)) setSections(data.sections);
        if (data.dayOfWeek != null) setDayOfWeek(data.dayOfWeek);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [guildId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const save = async () => {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/digest/config`, {
        method: 'PUT',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({ enabled, targetChannelId: targetChannelId || null, sections, dayOfWeek }),
      });
      if (res.ok) addToast({ title: 'Digest config saved', variant: 'success' });
      else addToast({ title: 'Failed to save', variant: 'error' });
    } catch { addToast({ title: 'Failed to save', variant: 'error' }); }
  };

  const loadPreview = async () => {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/digest/preview`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (res.ok) setPreview(await res.json());
    } catch { addToast({ title: 'Failed to load preview', variant: 'error' }); }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/digest/history`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (res.ok) {
        setPastDigests(await res.json());
        setShowHistory(true);
      }
    } catch { /* ignore */ }
  };

  const toggleSection = (key: string) => {
    setSections(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
  };

  if (loading) return <div className="text-gray-400 p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Newspaper className="w-5 h-5" /> Weekly Digest
        </h3>
        <div className="flex gap-2">
          <button onClick={loadPreview} className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button onClick={save} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm">
            <Save className="w-4 h-4" /> Save
          </button>
        </div>
      </div>

      {/* Enable toggle */}
      <label className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg border border-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => setEnabled(e.target.checked)}
          className="rounded border-gray-600 bg-gray-800 text-indigo-500"
        />
        <div>
          <span className="text-white text-sm">Enable Weekly Digest</span>
          <p className="text-gray-500 text-xs">Automatically post a weekly summary to a channel</p>
        </div>
      </label>

      {/* Channel picker */}
      <div>
        <label className="text-sm text-gray-400 mb-1 block">Target Channel</label>
        <select
          value={targetChannelId}
          onChange={e => setTargetChannelId(e.target.value)}
          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
        >
          <option value="">Select a channel</option>
          {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
        </select>
      </div>

      {/* Day of week */}
      <div>
        <label className="text-sm text-gray-400 mb-1 block flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Day of Week</label>
        <select
          value={dayOfWeek}
          onChange={e => setDayOfWeek(parseInt(e.target.value))}
          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
        >
          {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
      </div>

      {/* Section toggles */}
      <div>
        <label className="text-sm text-gray-400 mb-2 block">Digest Sections</label>
        <div className="space-y-1">
          {ALL_SECTIONS.map(s => (
            <label key={s.key} className="flex items-center gap-2 p-2 bg-gray-900 rounded border border-gray-700 cursor-pointer hover:border-gray-600">
              <input
                type="checkbox"
                checked={sections.includes(s.key)}
                onChange={() => toggleSection(s.key)}
                className="rounded border-gray-600 bg-gray-800 text-indigo-500"
              />
              <span className="text-sm text-gray-300">{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
          <h4 className="text-white font-semibold text-sm">Digest Preview</h4>
          <div className="text-sm text-gray-300 space-y-2">
            <p>Messages this week: <span className="text-white font-semibold">{preview.messageCount}</span></p>
            <p>New members: <span className="text-white font-semibold">{preview.newMembers.length}</span></p>
            {preview.activeChannels.length > 0 && (
              <div>
                <p className="text-gray-400 text-xs mb-1">Most Active Channels:</p>
                {preview.activeChannels.map((c, i) => (
                  <p key={i} className="text-xs">#{c.channelName} - {c.messageCount} messages</p>
                ))}
              </div>
            )}
            {preview.activeMembers.length > 0 && (
              <div>
                <p className="text-gray-400 text-xs mb-1">Most Active Members:</p>
                {preview.activeMembers.map((m, i) => (
                  <p key={i} className="text-xs">{m.displayName || m.username} - {m.messageCount} messages</p>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setPreview(null)} className="text-xs text-gray-500 hover:text-gray-300">Close preview</button>
        </div>
      )}

      {/* History */}
      <button onClick={loadHistory} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
        <ChevronDown className="w-4 h-4" /> Past Digests
      </button>
      {showHistory && (
        <div className="space-y-2">
          {pastDigests.length === 0 && <p className="text-gray-500 text-sm">No past digests</p>}
          {pastDigests.map(d => (
            <div key={d.id} className="bg-gray-900 border border-gray-700 rounded p-3">
              <p className="text-white text-sm font-medium">Week of {new Date(d.weekStart).toLocaleDateString()}</p>
              <p className="text-gray-500 text-xs">Generated {new Date(d.createdAt).toLocaleString()}</p>
              <p className="text-gray-400 text-xs mt-1">
                {(d.content as DigestPreview).messageCount} messages, {(d.content as DigestPreview).newMembers?.length || 0} new members
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
