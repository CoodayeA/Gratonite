import { useState, useEffect } from 'react';
import { API_BASE, getAccessToken } from '../../../lib/api';

const SettingsAchievementsTab = () => {
  const [achievements, setAchievements] = useState<Array<{ id: string; name: string; description: string; earned: boolean; points: number }>>([]);

  useEffect(() => {
    const controller = new AbortController();
    const token = getAccessToken() ?? '';
    fetch(`${API_BASE}/users/@me/achievements`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    }).then(r => r.ok ? r.json() : []).then((data: Array<{ id: string; name: string; description: string; earned: boolean; points: number }>) => {
      if (Array.isArray(data)) setAchievements(data);
    }).catch((err: unknown) => { if ((err as { name?: string })?.name === 'AbortError') return; });
    return () => controller.abort();
  }, []);

  return (
    <div style={{ padding: '0 40px' }}>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Achievements</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
        {achievements.filter(a => a.earned).length} / {achievements.length} earned
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
        {achievements.map((a) => (
          <div key={a.id} style={{
            padding: '16px',
            background: a.earned ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${a.earned ? 'var(--accent-primary)' : 'var(--stroke)'}`,
            opacity: a.earned ? 1 : 0.5,
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <div style={{ fontSize: '24px' }}>{a.earned ? '\u{1F3C6}' : '\u{1F512}'}</div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{a.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{a.description}</div>
            {a.earned && <div style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600 }}>+{a.points} pts</div>}
          </div>
        ))}
        {achievements.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
            Loading achievements...
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsAchievementsTab;
