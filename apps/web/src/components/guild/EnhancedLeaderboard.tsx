/**
 * 130. Leaderboard Improvements — Enhanced leaderboard with period tabs and multiple metrics.
 */
import { useState, useEffect } from 'react';
import { Trophy, Medal, TrendingUp, Crown } from 'lucide-react';
import { api } from '../../lib/api';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
  fameReceived: number;
  memberSince: string;
}

type Period = 'week' | 'month' | 'all';

export default function EnhancedLeaderboard({ guildId }: { guildId?: string }) {
  const [period, setPeriod] = useState<Period>('week');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetcher = guildId
      ? api.leaderboard.getGuild(guildId, period)
      : api.leaderboard.get(period);
    fetcher.then(setEntries).catch(() => {}).finally(() => setLoading(false));
  }, [period, guildId]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm text-gray-500 font-bold">#{rank}</span>;
  };

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-yellow-900/20 border-yellow-700/50';
    if (rank === 2) return 'bg-gray-700/30 border-gray-600/50';
    if (rank === 3) return 'bg-amber-900/20 border-amber-800/50';
    return 'bg-gray-800/50 border-gray-700/30';
  };

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" /> Leaderboard
        </h3>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
          {(['week', 'month', 'all'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded-md capitalize transition-colors ${
                period === p ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {p === 'all' ? 'All Time' : p === 'week' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry, i) => (
            <div
              key={entry.userId}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-gray-800/70 ${getRankBg(entry.rank)}`}
            >
              <div className="w-8 flex-shrink-0 flex justify-center">
                {getRankIcon(entry.rank)}
              </div>
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-sm text-white font-medium flex-shrink-0">
                {(entry.displayName || entry.username || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{entry.displayName || entry.username}</p>
                <p className="text-xs text-gray-500">
                  Member since {new Date(entry.memberSince).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm text-indigo-400 font-medium flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {entry.fameReceived}
                </p>
                <p className="text-xs text-gray-500">fame</p>
              </div>
            </div>
          ))}
          {entries.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">No leaderboard data for this period.</p>
          )}
        </div>
      )}
    </div>
  );
}
