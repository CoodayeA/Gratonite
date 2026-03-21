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

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    borderRadius: 4,
    padding: '8px 12px',
    fontSize: 14,
    border: '1px solid var(--border)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={20} style={{ color: '#c084fc' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Community Quests</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {(['active', 'completed', 'all'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  textTransform: 'capitalize',
                  transition: 'color 0.15s, background 0.15s',
                  background: filter === f ? '#9333ea' : 'transparent',
                  color: filter === f ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                }}>
                {f}
              </button>
            ))}
          </div>
          {isAdmin && (
            <button onClick={() => setShowCreate(!showCreate)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: '#9333ea',
                color: 'var(--text-primary)',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}>
              {showCreate ? <X size={14} /> : <Plus size={14} />}
              {showCreate ? 'Cancel' : 'New Quest'}
            </button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 16, marginBottom: 24, border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 0, marginBottom: 12 }}>Create Quest</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <input placeholder="Quest title" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <textarea placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
                style={{ ...inputStyle, resize: 'none' }} />
            </div>
            <select value={newType} onChange={e => setNewType(e.target.value)}
              style={{ ...inputStyle, color: 'var(--text-secondary)' }}>
              {QUEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="number" min={1} placeholder="Target" value={newTarget} onChange={e => setNewTarget(Number(e.target.value))}
              style={inputStyle} />
            <input type="number" min={0} placeholder="Reward (coins)" value={newReward} onChange={e => setNewReward(Number(e.target.value))}
              style={inputStyle} />
            <input type="datetime-local" value={newEndDate} onChange={e => setNewEndDate(e.target.value)}
              style={inputStyle} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
              <input type="checkbox" checked={newRecurring} onChange={e => setNewRecurring(e.target.checked)} />
              Recurring quest
            </label>
          </div>
          <button onClick={createQuest}
            style={{
              marginTop: 12,
              background: '#9333ea',
              color: 'var(--text-primary)',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}>
            Create Quest
          </button>
        </div>
      )}

      {/* Quest list */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 48, paddingBottom: 48 }}>Loading quests...</div>
      ) : quests.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 48, paddingBottom: 48 }}>No quests found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {quests.map(quest => {
            const pct = Math.min((quest.currentValue / quest.targetValue) * 100, 100);
            const isComplete = !!quest.completedAt;
            return (
              <div key={quest.id} style={{ background: 'var(--bg-secondary)', borderRadius: 8, border: `1px solid ${isComplete ? 'var(--success)' : 'var(--border)'}` }}>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{quest.title}</h3>
                        {isComplete && <Trophy size={14} style={{ color: 'var(--warning)' }} />}
                        {quest.recurring && (
                          <span style={{
                            fontSize: 12,
                            background: 'rgba(59,130,246,0.2)',
                            color: '#60a5fa',
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}>Recurring</span>
                        )}
                      </div>
                      {quest.description && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}>{quest.description}</p>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!isComplete && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                          <Clock size={12} />
                          {timeRemaining(quest.endDate)}
                        </div>
                      )}
                      {isAdmin && (
                        <button onClick={() => deleteQuest(quest.id)}
                          style={{ padding: 4, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ width: '100%', background: 'var(--bg-tertiary)', borderRadius: 9999, height: 10, marginBottom: 8 }}>
                    <div style={{
                      height: '100%',
                      borderRadius: 9999,
                      transition: 'width 0.5s',
                      background: isComplete ? 'var(--success)' : '#a855f7',
                      width: `${pct}%`,
                    }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{quest.currentValue} / {quest.targetValue} ({Math.round(pct)}%)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--warning)' }}>
                      <Trophy size={12} />
                      {(quest.reward as { coins?: number })?.coins ?? 0} coins
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    {!isComplete && (
                      <button onClick={() => contribute(quest.id)}
                        style={{
                          fontSize: 12,
                          background: '#9333ea',
                          color: 'var(--text-primary)',
                          padding: '4px 12px',
                          borderRadius: 4,
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}>
                        Contribute
                      </button>
                    )}
                    <button onClick={() => toggleExpand(quest.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'color 0.15s',
                      }}>
                      <Users size={12} />
                      Contributors
                      {expandedQuest === quest.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>

                {/* Expanded contributions */}
                {expandedQuest === quest.id && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
                    {!contributions[quest.id] ? (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Loading...</p>
                    ) : contributions[quest.id].length === 0 ? (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No contributions yet</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {contributions[quest.id].map(c => (
                          <div key={c.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{c.displayName || c.username}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{c.total} contributions</span>
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
