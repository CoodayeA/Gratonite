import { useState, useEffect } from 'react';
import { Flame, Trophy, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastInteraction: string | null;
  friendsSince: string | null;
}

interface Milestone {
  id: string;
  milestone: string;
  unlockedAt: string;
}

interface FriendshipStreakProps {
  friendId: string;
  compact?: boolean;
}

const MILESTONE_LABELS: Record<string, string> = {
  '1_week': '1 Week',
  '1_month': '1 Month',
  '3_months': '3 Months',
  '6_months': '6 Months',
  '1_year': '1 Year',
};

export default function FriendshipStreak({ friendId, compact }: FriendshipStreakProps) {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  useEffect(() => {
    loadStreak();
    loadMilestones();
  }, [friendId]);

  async function loadStreak() {
    try {
      const data = await api.get<StreakData>(`/relationships/${friendId}/streak`);
      setStreak(data);
    } catch {
      setStreak(null);
    }
  }

  async function loadMilestones() {
    try {
      const data = await api.get<Milestone[]>(`/relationships/${friendId}/milestones`);
      setMilestones(data);
    } catch {
      setMilestones([]);
    }
  }

  if (!streak || streak.currentStreak === 0) return null;

  const hoursRemaining = streak.lastInteraction
    ? Math.max(0, 48 - (Date.now() - new Date(streak.lastInteraction).getTime()) / (1000 * 60 * 60))
    : 0;
  const atRisk = hoursRemaining > 0 && hoursRemaining < 4;
  const streakColor = atRisk ? '#f87171' : '#fb923c';

  if (compact) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }} title={`${streak.currentStreak} day streak`}>
        <Flame size={12} style={{ color: streakColor, animation: atRisk ? 'pulse 1.5s ease-in-out infinite' : undefined, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, color: streakColor }}>{streak.currentStreak}</span>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Flame size={18} style={{ color: streakColor, animation: atRisk ? 'pulse 1.5s ease-in-out infinite' : undefined }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {streak.currentStreak} day streak
          </span>
        </div>
        {atRisk && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#f87171' }}>
            <AlertTriangle size={12} />
            Streak at risk!
          </div>
        )}
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        Longest: {streak.longestStreak} days
      </div>

      {milestones.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '4px' }}>
          {milestones.map((m) => (
            <div
              key={m.id}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-secondary)', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}
              title={`Unlocked ${new Date(m.unlockedAt).toLocaleDateString()}`}
            >
              <Trophy size={10} style={{ color: '#facc15', flexShrink: 0 }} />
              {MILESTONE_LABELS[m.milestone] ?? m.milestone}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
