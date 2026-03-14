/**
 * 121. XP & Leveling System — XP display, progress bar, and leaderboard.
 * 131. Streaks — Display consecutive day streaks.
 */
import { useState, useEffect } from 'react';
import { Star, TrendingUp, Flame, Trophy } from 'lucide-react';
import { api } from '../../lib/api';

export function XpBar() {
  const [data, setData] = useState<{ xp: number; level: number; progress: number; xpForNextLevel: number } | null>(null);

  useEffect(() => {
    api.xp.getMyXp().then(setData).catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-900/50 rounded-full">
        <Star className="w-3.5 h-3.5 text-yellow-400" />
        <span className="text-xs text-white font-medium">Lv.{data.level}</span>
      </div>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden max-w-[100px]">
        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${data.progress * 100}%` }} />
      </div>
      <span className="text-xs text-gray-500">{data.xp}/{data.xpForNextLevel} XP</span>
    </div>
  );
}

export function XpLeaderboard({ guildId }: { guildId: string }) {
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    api.xp.getGuildLeaderboard(guildId).then(setEntries).catch(() => {});
  }, [guildId]);

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <h3 className="text-white font-medium flex items-center gap-2 mb-3"><Trophy className="w-5 h-5 text-yellow-400" /> XP Leaderboard</h3>
      <div className="space-y-1">
        {entries.map((e, i) => (
          <div key={e.userId} className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded">
            <span className={`text-sm font-bold w-6 text-center ${i < 3 ? 'text-yellow-400' : 'text-gray-500'}`}>#{e.rank}</span>
            <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-xs text-white">
              {(e.displayName || e.username || '?')[0]}
            </div>
            <div className="flex-1">
              <p className="text-sm text-white">{e.displayName || e.username}</p>
              <p className="text-xs text-gray-500">Level {e.level}</p>
            </div>
            <span className="text-sm text-indigo-400 font-medium">{e.xp} XP</span>
          </div>
        ))}
        {entries.length === 0 && <p className="text-gray-500 text-sm">No XP data yet.</p>}
      </div>
    </div>
  );
}

export function StreakDisplay({ currentStreak, longestStreak }: { currentStreak: number; longestStreak: number }) {
  if (currentStreak === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <Flame className={`w-4 h-4 ${currentStreak >= 7 ? 'text-orange-400' : 'text-gray-400'}`} />
      <span className="text-xs text-orange-300 font-medium">{currentStreak} day streak</span>
      {longestStreak > currentStreak && (
        <span className="text-xs text-gray-500">(best: {longestStreak})</span>
      )}
    </div>
  );
}

export function GuildXpCard({ guildId }: { guildId: string }) {
  const [data, setData] = useState<{ xp: number; level: number; progress: number } | null>(null);

  useEffect(() => {
    api.xp.getGuildXp(guildId).then(setData).catch(() => {});
  }, [guildId]);

  if (!data) return null;

  return (
    <div className="p-3 bg-gray-800 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-4 h-4 text-indigo-400" />
        <span className="text-sm text-white">Server Level {data.level}</span>
        <span className="text-xs text-gray-500 ml-auto">{data.xp} XP</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${data.progress * 100}%` }} />
      </div>
    </div>
  );
}
