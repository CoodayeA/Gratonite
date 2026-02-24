import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar } from '@/components/ui/Avatar';

type Period = 'week' | 'month' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
};

function getMedalEmoji(rank: number): string {
  if (rank === 1) return '\u{1F947} ';
  if (rank === 2) return '\u{1F948} ';
  if (rank === 3) return '\u{1F949} ';
  return '';
}

export function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>('week');
  const currentUser = useAuthStore((s) => s.user);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['leaderboard', period],
    queryFn: () => api.leaderboard.get(period),
  });

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-header">
        <h2>Leaderboard</h2>
      </div>

      <div className="leaderboard-filters">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            className={`leaderboard-filter-btn${period === p ? ' active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="leaderboard-empty">Loading leaderboard...</div>
      ) : entries.length === 0 ? (
        <div className="leaderboard-empty">No leaderboard data yet.</div>
      ) : (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>User</th>
              <th>Messages</th>
              <th>{'\u{20B2}'} Earned</th>
              <th>Member Since</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isCurrentUser = currentUser?.id === entry.userId;
              return (
                <tr
                  key={entry.userId}
                  className={`leaderboard-row${isCurrentUser ? ' current-user' : ''}`}
                >
                  <td className="leaderboard-rank">
                    {getMedalEmoji(entry.rank)}{entry.rank}
                  </td>
                  <td>
                    <div className="leaderboard-user-cell">
                      <Avatar
                        name={entry.displayName}
                        hash={entry.avatarHash}
                        userId={entry.userId}
                        size={32}
                      />
                      <span className="leaderboard-user-name">
                        {entry.displayName}
                      </span>
                    </div>
                  </td>
                  <td>{entry.messageCount.toLocaleString()}</td>
                  <td>{entry.gratonitesEarned.toLocaleString()}</td>
                  <td>{formatDate(entry.memberSince)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
