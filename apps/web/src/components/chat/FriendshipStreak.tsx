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

const MILESTONE_ICONS: Record<string, string> = {
  '1_week': '7',
  '1_month': '30',
  '3_months': '90',
  '6_months': '180',
  '1_year': '365',
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

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1 text-xs">
        <Flame className={`w-3 h-3 ${atRisk ? 'text-red-400 animate-pulse' : 'text-orange-400'}`} />
        <span className={`font-semibold ${atRisk ? 'text-red-400' : 'text-orange-400'}`}>
          {streak.currentStreak}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800/60 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className={`w-5 h-5 ${atRisk ? 'text-red-400 animate-pulse' : 'text-orange-400'}`} />
          <span className="text-sm font-semibold text-zinc-100">
            {streak.currentStreak} day streak
          </span>
        </div>
        {atRisk && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            Streak at risk!
          </div>
        )}
      </div>

      <div className="text-xs text-zinc-400">
        Longest: {streak.longestStreak} days
      </div>

      {milestones.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {milestones.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-1 bg-zinc-700/50 rounded-full px-2 py-0.5 text-xs text-zinc-300"
              title={`Unlocked ${new Date(m.unlockedAt).toLocaleDateString()}`}
            >
              <Trophy className="w-3 h-3 text-yellow-400" />
              {MILESTONE_LABELS[m.milestone] ?? m.milestone}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
