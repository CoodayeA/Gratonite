import { useState, useEffect } from 'react';
import { API_BASE, getAccessToken } from '../../../lib/api';

interface UserStatsData {
  level: number;
  xp: number;
  xpToNextLevel: number;
  xpForCurrentLevel: number;
  currentStreak: number;
  longestStreak: number;
  coins: number;
  achievementsEarned: number;
  bookmarks: number;
}

const SettingsStatsTab = () => {
  const [userStats, setUserStats] = useState<UserStatsData | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const token = getAccessToken() ?? '';
    fetch(`${API_BASE}/users/@me/stats`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    }).then(r => r.ok ? r.json() : null).then((data: UserStatsData | null) => {
      if (data) setUserStats(data);
    }).catch((err: unknown) => { if ((err as { name?: string })?.name === 'AbortError') return; });
    return () => controller.abort();
  }, []);

  return (
    <div style={{ padding: '0 40px' }}>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Your Stats</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Activity overview</p>
      {userStats ? (
        <>
          <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--accent-primary)' }}>Level {userStats.level}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{userStats.xp} / {userStats.xpToNextLevel} XP</span>
            </div>
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '4px', background: 'var(--accent-primary)',
                width: `${Math.min(100, ((userStats.xp - userStats.xpForCurrentLevel) / (userStats.xpToNextLevel - userStats.xpForCurrentLevel)) * 100)}%`,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
            {[
              { label: '\u{1F525} Current Streak', value: `${userStats.currentStreak} ${userStats.currentStreak === 1 ? 'day' : 'days'}` },
              { label: '\u{1F3C6} Best Streak', value: `${userStats.longestStreak} ${userStats.longestStreak === 1 ? 'day' : 'days'}` },
              { label: '\u{1FA99} Coins', value: userStats.coins },
              { label: '\u{2B50} Achievements', value: userStats.achievementsEarned },
              { label: '\u{1F516} Bookmarks', value: userStats.bookmarks },
            ].map(stat => (
              <div key={stat.label} style={{
                padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--stroke)', textAlign: 'center',
              }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px' }}>{stat.value}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Loading stats...</div>
      )}
    </div>
  );
};

export default SettingsStatsTab;
