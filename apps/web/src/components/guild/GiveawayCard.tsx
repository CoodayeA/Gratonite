import { useState, useEffect, useCallback } from 'react';
import { Gift, Users, Clock, Trophy, Plus, Trash2 } from 'lucide-react';
import { API_BASE } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface GiveawayData {
  id: string;
  guildId: string;
  channelId: string;
  prize: string;
  description: string | null;
  winnersCount: number;
  endsAt: string;
  endedAt: string | null;
  hostId: string;
  requiredRoleId: string | null;
  status: string;
  createdAt: string;
  entryCount: number;
  winners?: Array<{ id: string; username: string; displayName: string }>;
}

interface Channel {
  id: string;
  name: string;
}

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('gratonite_access_token') ?? ''}`,
  'Content-Type': 'application/json',
});

function Countdown({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Ended'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return <span>{timeLeft}</span>;
}

export default function GiveawayCard({ guildId, isAdmin, channels }: {
  guildId: string;
  isAdmin: boolean;
  channels: Channel[];
}) {
  const { addToast } = useToast();
  const [giveaways, setGiveaways] = useState<GiveawayData[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ channelId: '', prize: '', description: '', winnersCount: 1, endsAt: '' });

  const fetchGiveaways = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/giveaways`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (res.ok) setGiveaways(await res.json());
    } catch { /* ignore */ }
  }, [guildId]);

  useEffect(() => { fetchGiveaways(); }, [fetchGiveaways]);

  const createGiveaway = async () => {
    if (!form.prize.trim() || !form.channelId || !form.endsAt) return;
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/giveaways`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({
          channelId: form.channelId,
          prize: form.prize,
          description: form.description || null,
          winnersCount: form.winnersCount,
          endsAt: new Date(form.endsAt).toISOString(),
        }),
      });
      if (res.ok) {
        addToast({ title: 'Giveaway created!', variant: 'success' });
        setShowCreate(false);
        setForm({ channelId: '', prize: '', description: '', winnersCount: 1, endsAt: '' });
        fetchGiveaways();
      }
    } catch { addToast({ title: 'Failed to create giveaway', variant: 'error' }); }
  };

  const enterGiveaway = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/giveaways/${id}/enter`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (res.ok) {
        addToast({ title: 'Entered giveaway!', variant: 'success' });
        fetchGiveaways();
      }
    } catch { /* ignore */ }
  };

  const leaveGiveaway = async (id: string) => {
    try {
      await fetch(`${API_BASE}/guilds/${guildId}/giveaways/${id}/enter`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });
      addToast({ title: 'Left giveaway', variant: 'success' });
      fetchGiveaways();
    } catch { /* ignore */ }
  };

  const endGiveaway = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/guilds/${guildId}/giveaways/${id}/end`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (res.ok) {
        addToast({ title: 'Giveaway ended!', variant: 'success' });
        fetchGiveaways();
      }
    } catch { /* ignore */ }
  };

  const cancelGiveaway = async (id: string) => {
    try {
      await fetch(`${API_BASE}/guilds/${guildId}/giveaways/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });
      addToast({ title: 'Giveaway cancelled', variant: 'success' });
      fetchGiveaways();
    } catch { /* ignore */ }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Gift className="w-5 h-5 text-purple-400" /> Giveaways
        </h2>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm">
            <Plus className="w-4 h-4" /> Create
          </button>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
          <input
            value={form.prize}
            onChange={e => setForm(f => ({ ...f, prize: e.target.value }))}
            placeholder="Prize (e.g., Nitro, Gift Card)"
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
          />
          <input
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)"
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.channelId}
              onChange={e => setForm(f => ({ ...f, channelId: e.target.value }))}
              className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            >
              <option value="">Select channel</option>
              {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
            <input
              type="number"
              min={1}
              value={form.winnersCount}
              onChange={e => setForm(f => ({ ...f, winnersCount: parseInt(e.target.value) || 1 }))}
              placeholder="Winners"
              className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            />
          </div>
          <input
            type="datetime-local"
            value={form.endsAt}
            onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button onClick={createGiveaway} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm">Create</button>
          </div>
        </div>
      )}

      {/* Giveaway list */}
      <div className="space-y-3">
        {giveaways.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">No giveaways</p>
        )}
        {giveaways.map(g => (
          <div key={g.id} className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  {g.prize}
                </h3>
                {g.description && <p className="text-gray-400 text-sm mt-1">{g.description}</p>}
              </div>
              {g.status === 'active' && (
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">Active</span>
              )}
              {g.status === 'ended' && (
                <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded text-xs">Ended</span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {g.entryCount} entries</span>
              <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> {g.winnersCount} winner{g.winnersCount > 1 ? 's' : ''}</span>
              {g.status === 'active' && (
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> <Countdown endsAt={g.endsAt} /></span>
              )}
            </div>

            <div className="flex gap-2 mt-3">
              {g.status === 'active' && (
                <>
                  <button onClick={() => enterGiveaway(g.id)} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm">
                    Enter
                  </button>
                  <button onClick={() => leaveGiveaway(g.id)} className="px-3 py-1.5 text-gray-400 hover:text-white text-sm">
                    Leave
                  </button>
                  {isAdmin && (
                    <>
                      <button onClick={() => endGiveaway(g.id)} className="px-3 py-1.5 bg-yellow-600/50 hover:bg-yellow-600 text-white rounded text-sm ml-auto">End Now</button>
                      <button onClick={() => cancelGiveaway(g.id)} className="p-1.5 text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
