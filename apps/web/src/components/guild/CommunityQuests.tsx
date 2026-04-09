/**
 * 129. Community Challenges / Guild Quests — Collaborative quest progress UI.
 */
import { useState, useEffect, useCallback } from 'react';
import { Target, Users, Trophy, Plus, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface Quest {
  id: string;
  title: string;
  description?: string;
  questType: string;
  targetValue: number;
  currentValue: number;
  reward: number;
  endDate: string;
  completedAt: string | null;
  createdAt: string;
}

export default function CommunityQuests({ guildId }: { guildId: string }) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', targetValue: '100', reward: '50', endDate: '' });
  const { addToast } = useToast();

  const fetch_ = useCallback(async () => {
    try { setQuests(await api.guildQuests.list(guildId, tab)); } catch {}
  }, [guildId, tab]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const create = async () => {
    if (!form.title.trim() || !form.endDate) return;
    try {
      await api.guildQuests.create(guildId, {
        title: form.title,
        description: form.description,
        targetValue: parseInt(form.targetValue) || 100,
        reward: parseInt(form.reward) || 0,
        endDate: form.endDate,
      });
      setShowCreate(false);
      setForm({ title: '', description: '', targetValue: '100', reward: '50', endDate: '' });
      fetch_();
    } catch { addToast({ title: 'Failed to create quest', variant: 'error' }); }
  };

  const contribute = async (questId: string) => {
    try {
      await api.guildQuests.contribute(guildId, questId);
      fetch_();
    } catch { addToast({ title: 'Failed to contribute to quest', variant: 'error' }); }
  };

  const daysUntil = (endDate: string) => {
    const diff = new Date(endDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium flex items-center gap-2">
          <Target className="w-5 h-5 text-orange-400" /> Community Challenges
        </h3>
        <button onClick={() => setShowCreate(!showCreate)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-3">
        {(['active', 'completed'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 text-sm rounded capitalize ${tab === t ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="p-3 bg-gray-800 rounded-lg space-y-2 mb-3">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Quest title" className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600" />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600 h-16" />
          <div className="flex gap-2">
            <input type="number" value={form.targetValue} onChange={e => setForm({ ...form, targetValue: e.target.value })} placeholder="Target" className="flex-1 bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600" />
            <input type="number" value={form.reward} onChange={e => setForm({ ...form, reward: e.target.value })} placeholder="Reward coins" className="flex-1 bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600" />
          </div>
          <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600" />
          <div className="flex gap-2">
            <button onClick={create} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded">Create Quest</button>
            <button onClick={() => setShowCreate(false)} className="text-sm text-gray-400">Cancel</button>
          </div>
        </div>
      )}

      {/* Quest list */}
      <div className="space-y-3">
        {quests.map(quest => {
          const progress = Math.min(100, (quest.currentValue / quest.targetValue) * 100);
          const completed = !!quest.completedAt;
          return (
            <div key={quest.id} className={`p-3 rounded-lg border ${completed ? 'bg-green-900/10 border-green-800' : 'bg-gray-800 border-gray-700'}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm text-white font-medium flex items-center gap-1">
                    {completed && <Trophy className="w-3.5 h-3.5 text-yellow-400" />}
                    {quest.title}
                  </p>
                  {quest.description && <p className="text-xs text-gray-400 mt-0.5">{quest.description}</p>}
                </div>
                {!completed && (
                  <span className="text-xs text-gray-500 flex-shrink-0">{daysUntil(quest.endDate)}d left</span>
                )}
              </div>

              {/* Progress bar */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>{quest.currentValue} / {quest.targetValue}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${completed ? 'bg-green-500' : 'bg-orange-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                {quest.reward > 0 && (
                  <span className="text-xs text-yellow-400">Reward: {quest.reward} coins</span>
                )}
                {!completed && (
                  <button
                    onClick={() => contribute(quest.id)}
                    className="flex items-center gap-1 px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white text-xs rounded ml-auto"
                  >
                    Contribute <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {quests.length === 0 && (
          <p className="text-gray-500 text-sm">{tab === 'active' ? 'No active quests. Create one!' : 'No completed quests yet.'}</p>
        )}
      </div>
    </div>
  );
}
