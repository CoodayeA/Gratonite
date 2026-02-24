import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastLoginAt: string | null;
  totalLogins: number;
}

export function EarnSection() {
  const user = useAuthStore((s) => s.user);
  
  const { data: streak } = useQuery<StreakData>({
    queryKey: ['gratonites', 'streak'],
    queryFn: () => fetch('/api/v1/gratonites/streak', { credentials: 'include' }).then(r => r.json()),
    enabled: !!user?.id,
  });

  const { data: balance } = useQuery<{ balance: number; lifetimeEarned: number }>({
    queryKey: ['gratonites', 'balance'],
    queryFn: () => fetch('/api/v1/gratonites/balance', { credentials: 'include' }).then(r => r.json()),
    enabled: !!user?.id,
  });

  // Calculate next milestone
  const messageCount = user?.messageCount || 0;
  const nextMilestone = messageCount < 100 ? 100 : messageCount < 500 ? 500 : messageCount < 1000 ? 1000 : null;
  const progress = nextMilestone ? Math.round((messageCount / nextMilestone) * 100) : 100;

  return (
    <section className="settings-section">
      <h2 className="settings-shell-section-heading">Earn Gratonites</h2>
      
      {/* Balance Overview */}
      <div className="settings-card">
        <div className="settings-field">
          <div className="settings-field-label">Your Balance</div>
          <div className="earn-balance-display">
            <span className="earn-balance-amount">{balance?.balance?.toLocaleString() || 0}</span>
            <span className="earn-balance-label">Gratonites</span>
          </div>
        </div>
        <div className="settings-field">
          <div className="settings-field-value">
            Lifetime earned: {balance?.lifetimeEarned?.toLocaleString() || 0}
          </div>
        </div>
      </div>

      {/* Daily Login Rewards */}
      <div className="settings-card">
        <div className="settings-field">
          <div className="settings-field-label">Daily Login Rewards</div>
          <div className="settings-field-value">
            Earn 10 Gratonites every day you log in!
          </div>
        </div>
        
        <div className="earn-streak-display">
          <div className="earn-streak-item">
            <span className="earn-streak-number">{streak?.currentStreak || 0}</span>
            <span className="earn-streak-label">Current Streak</span>
          </div>
          <div className="earn-streak-item">
            <span className="earn-streak-number">{streak?.longestStreak || 0}</span>
            <span className="earn-streak-label">Longest Streak</span>
          </div>
          <div className="earn-streak-item">
            <span className="earn-streak-number">{streak?.totalLogins || 0}</span>
            <span className="earn-streak-label">Total Logins</span>
          </div>
        </div>

        <div className="earn-streak-bonuses">
          <h4>Streak Bonuses</h4>
          <ul>
            <li className={(streak?.currentStreak || 0) >= 3 ? 'earn-completed' : ''}>
              <span>3-day streak: +5 Gratonites</span>
              {(streak?.currentStreak || 0) >= 3 && <span className="earn-check">✓</span>}
            </li>
            <li className={(streak?.currentStreak || 0) >= 7 ? 'earn-completed' : ''}>
              <span>7-day streak: +15 Gratonites</span>
              {(streak?.currentStreak || 0) >= 7 && <span className="earn-check">✓</span>}
            </li>
            <li className={(streak?.currentStreak || 0) >= 30 ? 'earn-completed' : ''}>
              <span>30-day streak: +50 Gratonites</span>
              {(streak?.currentStreak || 0) >= 30 && <span className="earn-check">✓</span>}
            </li>
          </ul>
        </div>
      </div>

      {/* Message Milestones */}
      <div className="settings-card">
        <div className="settings-field">
          <div className="settings-field-label">Message Milestones</div>
          <div className="settings-field-value">
            Send messages to earn bonus Gratonites!
          </div>
        </div>

        <div className="earn-milestones">
          <div className={`earn-milestone ${messageCount >= 100 ? 'earn-completed' : ''}`}>
            <div className="earn-milestone-header">
              <span>100 messages</span>
              <span className="earn-reward">+20 G</span>
            </div>
            {messageCount < 100 && nextMilestone === 100 && (
              <div className="earn-progress-bar">
                <div className="earn-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>

          <div className={`earn-milestone ${messageCount >= 500 ? 'earn-completed' : ''}`}>
            <div className="earn-milestone-header">
              <span>500 messages</span>
              <span className="earn-reward">+100 G</span>
            </div>
            {messageCount >= 100 && messageCount < 500 && nextMilestone === 500 && (
              <div className="earn-progress-bar">
                <div className="earn-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>

          <div className={`earn-milestone ${messageCount >= 1000 ? 'earn-completed' : ''}`}>
            <div className="earn-milestone-header">
              <span>1,000 messages</span>
              <span className="earn-reward">+250 G</span>
            </div>
            {messageCount >= 500 && messageCount < 1000 && nextMilestone === 1000 && (
              <div className="earn-progress-bar">
                <div className="earn-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        </div>

        <div className="earn-current-count">
          You've sent {messageCount.toLocaleString()} messages
        </div>
      </div>
    </section>
  );
}
