import { useState, useEffect } from 'react';
import { Star, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface Channel {
  id: string;
  name: string;
}

interface StarboardConfigProps {
  guildId: string;
  channels: Channel[];
}

const STAR_EMOJIS = ['⭐', '🌟', '💫', '✨', '🔥', '❤️', '👍', '🏆'];

export default function StarboardConfig({ guildId, channels }: StarboardConfigProps) {
  const [targetChannelId, setTargetChannelId] = useState('');
  const [emoji, setEmoji] = useState('⭐');
  const [threshold, setThreshold] = useState(5);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    loadConfig();
  }, [guildId]);

  async function loadConfig() {
    try {
      const res = await api.get(`/guilds/${guildId}/starboard/config`);
      if (res.data) {
        setTargetChannelId(res.data.targetChannelId || '');
        setEmoji(res.data.emoji || '⭐');
        setThreshold(res.data.threshold ?? 5);
        setEnabled(res.data.enabled ?? true);
      }
    } catch { /* no config yet */ }
  }

  async function handleSave() {
    setLoading(true);
    try {
      await api.put(`/guilds/${guildId}/starboard/config`, {
        targetChannelId: targetChannelId || null,
        emoji,
        threshold,
        enabled,
      });
      addToast('Starboard config saved', 'success');
    } catch {
      addToast('Failed to save config', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Star className="w-5 h-5 text-yellow-500" /> Starboard
      </h3>

      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-300">Enable Starboard</label>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-gray-600'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div>
          <label className="text-sm text-gray-400 block mb-1">Starboard Channel</label>
          <select
            value={targetChannelId}
            onChange={e => setTargetChannelId(e.target.value)}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
          >
            <option value="">Select channel...</option>
            {channels.map(c => (
              <option key={c.id} value={c.id}># {c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-400 block mb-1">Reaction Emoji</label>
          <div className="flex gap-2 flex-wrap">
            {STAR_EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`w-10 h-10 rounded flex items-center justify-center text-lg
                  ${emoji === e ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-400 block mb-1">
            Threshold: {threshold} reaction{threshold !== 1 ? 's' : ''}
          </label>
          <input
            type="range"
            min={1}
            max={25}
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-full accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>1</span>
            <span>25</span>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
