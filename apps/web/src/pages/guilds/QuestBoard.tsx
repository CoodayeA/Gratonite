import { useState, useEffect } from 'react';
import { Target, Plus, Trash2, Clock, Trophy, Users, ChevronDown, ChevronUp, Edit2, X } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

type Quest = {
  id: string;
  guildId: string;
  title: string;
  description: string | null;
  questType: string;
  targetValue: number;
  currentValue: number;
  reward: { coins?: number; [key: string]: unknown };
  startDate: string;
  endDate: string;
  completedAt: string | null;
  recurring: boolean;
  createdAt: string;
};

type Contribution = {
  userId: string;
  username: string;
  displayName: string;
  total: number;
};

const QUEST_TYPES = [
  { value: 'messages', label: 'Messages' },
  { value: 'members', label: 'New Members' },
  { value: 'reactions', label: 'Reactions' },
  { value: 'voice_hours', label: 'Voice Hours' },
  { value: 'custom', label: 'Custom' },
];

const QuestBoard = ({ guildId, isAdmin }: { guildId: string; isAdmin?: boolean }) => {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedQuest, setExpandedQuest] = useState<string | null>(null);
  const [contributions, setContributions] = useState<Record<string, Contribution[]>>({});
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('messages');
  const [newTarget, setNewTarget] = useState(100);
  const [newReward, setNewReward] = useState(100);
  const [newEndDate, setNewEndDate] = useState('');
  const [newRecurring, setNewRecurring] = useState(false);

  useEffect(() => { loadQuests(); }, [guildId, filter]);

  const loadQuests = async () => {
    setLoading(true);
    try {
      const res = await api.quests.list(guildId, filter);
      setQuests(res as Quest[]);
    } catch { addToast({ title: 'Failed to load quests', variant: 'error' }); }
    setLoading(false);
  };

  const createQuest = async () => {
    if (!newTitle || !newEndDate) { addToast({ title: 'Title and end date are required', variant: 'error' }); return; }
    try {
      await api.quests.create(guildId, {
        title: newTitle, description: newDesc || undefined, questType: newType,
        targetValue: newTarget, reward: { coins: newReward }, endDate: newEndDate, recurring: newRecurring,
      });
      setShowCreate(false);
      setNewTitle(''); setNewDesc(''); setNewType('messages'); setNewTarget(100); setNewReward(100); setNewEndDate(''); setNewRecurring(false);
      loadQuests();
      addToast({ title: 'Quest created!', variant: 'success' });
    } catch { addToast({ title: 'Failed to create quest', variant: 'error' }); }
  };

  const deleteQuest = async (id: string) => {
    try {
      await api.quests.delete(guildId, id);
      loadQuests();
      addToast({ title: 'Quest deleted', variant: 'info' });
    } catch { addToast({ title: 'Failed to delete quest', variant: 'error' }); }
  };

  const contribute = async (id: string) => {
    try {
      const res = await api.quests.contribute(guildId, id, 1) as Quest;
      setQuests(prev => prev.map(q => q.id === id ? res : q));
      if (res.completedAt) {
        addToast({ title: 'Quest completed! Rewards earned!', variant: 'success' });
      }
    } catch { addToast({ title: 'Failed to contribute', variant: 'error' }); }
  };

  const loadContributions = async (questId: string) => {
    try {
      const res = await api.quests.contributions(guildId, questId);
      setContributions(prev => ({ ...prev, [questId]: res as Contribution[] }));
    } catch {}
  };

  const toggleExpand = (questId: string) => {
    if (expandedQuest === questId) {
      setExpandedQuest(null);
    } else {
      setExpandedQuest(questId);
      if (!contributions[questId]) loadContributions(questId);
    }
  };

  const timeRemaining = (endDate: string) => {
    const diff = new Date(endDate).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Target size={20} className="text-purple-400" />
          <h2 className="text-lg font-bold text-white">Community Quests</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            {(['active', 'completed', 'all'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs capitalize transition-colors ${filter === f ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                {f}
              </button>
            ))}
          </div>
          {isAdmin && (
            <button onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors">
              {showCreate ? <X size={14} /> : <Plus size={14} />}
              {showCreate ? 'Cancel' : 'New Quest'}
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
          <h3 className="text-sm font-semibold text-white mb-3">Create Quest</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <input placeholder="Quest title" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 placeholder-gray-500" />
            </div>
            <div className="col-span-2">
              <textarea placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 placeholder-gray-500 resize-none" />
            </div>
            <select value={newType} onChange={e => setNewType(e.target.value)}
              className="bg-gray-700 text-gray-300 rounded px-3 py-2 text-sm border border-gray-600">
              {QUEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="number" min={1} placeholder="Target" value={newTarget} onChange={e => setNewTarget(Number(e.target.value))}
              className="bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600" />
            <input type="number" min={0} placeholder="Reward (coins)" value={newReward} onChange={e => setNewReward(Number(e.target.value))}
              className="bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600" />
            <input type="datetime-local" value={newEndDate} onChange={e => setNewEndDate(e.target.value)}
              className="bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600" />
            <label className="flex items-center gap-2 text-sm text-gray-300 col-span-2">
              <input type="checkbox" checked={newRecurring} onChange={e => setNewRecurring(e.target.checked)}
                className="rounded bg-gray-700 border-gray-600" />
              Recurring quest
            </label>
          </div>
          <button onClick={createQuest}
            className="mt-3 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            Create Quest
          </button>
        </div>
      )}

      {/* Quest list */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading quests...</div>
      ) : quests.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No quests found</div>
      ) : (
        <div className="space-y-3">
          {quests.map(quest => {
            const pct = Math.min((quest.currentValue / quest.targetValue) * 100, 100);
            const isComplete = !!quest.completedAt;
            return (
              <div key={quest.id} className={`bg-gray-800 rounded-lg border ${isComplete ? 'border-green-700' : 'border-gray-700'}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{quest.title}</h3>
                        {isComplete && <Trophy size={14} className="text-yellow-400" />}
                        {quest.recurring && <span className="text-xs bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded">Recurring</span>}
                      </div>
                      {quest.description && <p className="text-xs text-gray-400 mt-1">{quest.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {!isComplete && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock size={12} />
                          {timeRemaining(quest.endDate)}
                        </div>
                      )}
                      {isAdmin && (
                        <button onClick={() => deleteQuest(quest.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
                    <div className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-purple-500'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{quest.currentValue} / {quest.targetValue} ({Math.round(pct)}%)</span>
                    <div className="flex items-center gap-1 text-yellow-400">
                      <Trophy size={12} />
                      {(quest.reward as { coins?: number })?.coins ?? 0} coins
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    {!isComplete && (
                      <button onClick={() => contribute(quest.id)}
                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded transition-colors">
                        Contribute
                      </button>
                    )}
                    <button onClick={() => toggleExpand(quest.id)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors">
                      <Users size={12} />
                      Contributors
                      {expandedQuest === quest.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>

                {/* Expanded contributions */}
                {expandedQuest === quest.id && (
                  <div className="border-t border-gray-700 px-4 py-3">
                    {!contributions[quest.id] ? (
                      <p className="text-xs text-gray-500">Loading...</p>
                    ) : contributions[quest.id].length === 0 ? (
                      <p className="text-xs text-gray-500">No contributions yet</p>
                    ) : (
                      <div className="space-y-1">
                        {contributions[quest.id].map(c => (
                          <div key={c.userId} className="flex items-center justify-between text-xs">
                            <span className="text-gray-300">{c.displayName || c.username}</span>
                            <span className="text-gray-500">{c.total} contributions</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QuestBoard;
