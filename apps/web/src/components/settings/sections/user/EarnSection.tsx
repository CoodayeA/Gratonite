import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastLoginAt: string | null;
  totalLogins: number;
}

const styles = {
  section: {
    maxWidth: 720,
  } as React.CSSProperties,
  card: {
    background: 'var(--bg-float)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-lg)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  } as React.CSSProperties,
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as React.CSSProperties,
  fieldLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  fieldValue: {
    fontSize: 14,
    color: 'var(--text)',
  } as React.CSSProperties,
  balanceDisplay: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
  } as React.CSSProperties,
  balanceAmount: {
    fontSize: 32,
    fontWeight: 700,
    color: 'var(--accent-2)',
  } as React.CSSProperties,
  balanceLabel: {
    fontSize: 14,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  streakDisplay: {
    display: 'flex',
    gap: 24,
    marginTop: 16,
    padding: 16,
    background: 'var(--surface-1)',
    borderRadius: 'var(--radius-md)',
  } as React.CSSProperties,
  streakItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  } as React.CSSProperties,
  streakNumber: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--accent)',
  } as React.CSSProperties,
  streakLabel: {
    fontSize: 12,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  streakBonuses: {
    marginTop: 16,
  } as React.CSSProperties,
  streakBonusesTitle: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 8,
    color: 'var(--text-primary)',
  } as React.CSSProperties,
  streakBonusesList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  } as React.CSSProperties,
  streakBonusItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  streakBonusItemLast: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: 'none',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  completed: {
    color: '#22c55e',
  } as React.CSSProperties,
  check: {
    color: '#22c55e',
    fontWeight: 700,
  } as React.CSSProperties,
  milestones: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
  } as React.CSSProperties,
  milestone: {
    padding: 12,
    background: 'var(--surface-1)',
    borderRadius: 'var(--radius-md)',
    border: '2px solid transparent',
  } as React.CSSProperties,
  milestoneCompleted: {
    padding: 12,
    background: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 'var(--radius-md)',
    border: '2px solid #22c55e',
    color: '#22c55e',
  } as React.CSSProperties,
  milestoneHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  } as React.CSSProperties,
  reward: {
    color: 'var(--accent-2)',
    fontWeight: 600,
  } as React.CSSProperties,
  progressBar: {
    height: 4,
    background: 'var(--surface-2)',
    borderRadius: 2,
    overflow: 'hidden',
  } as React.CSSProperties,
  progressFill: {
    height: '100%',
    background: 'var(--accent)',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  } as React.CSSProperties,
  currentCount: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
};

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
    <section style={styles.section}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        paddingBottom: 16,
        borderBottom: '1px solid var(--stroke)',
        marginBottom: 8,
      }}>
        <h2 style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
          margin: 0,
          fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
        }}>
          Earn Gratonites
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Track your balance, daily login streaks, and message milestones.
        </p>
      </div>

      {/* Balance Overview */}
      <div style={styles.card}>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Your Balance</div>
          <div style={styles.balanceDisplay}>
            <span style={styles.balanceAmount}>{balance?.balance?.toLocaleString() || 0}</span>
            <span style={styles.balanceLabel}>Gratonites</span>
          </div>
        </div>
        <div style={styles.field}>
          <div style={styles.fieldValue}>
            Lifetime earned: {balance?.lifetimeEarned?.toLocaleString() || 0}
          </div>
        </div>
      </div>

      {/* Daily Login Rewards */}
      <div style={styles.card}>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Daily Login Rewards</div>
          <div style={styles.fieldValue}>
            Earn 10 Gratonites every day you log in!
          </div>
        </div>

        <div style={styles.streakDisplay}>
          <div style={styles.streakItem}>
            <span style={styles.streakNumber}>{streak?.currentStreak || 0}</span>
            <span style={styles.streakLabel}>Current Streak</span>
          </div>
          <div style={styles.streakItem}>
            <span style={styles.streakNumber}>{streak?.longestStreak || 0}</span>
            <span style={styles.streakLabel}>Longest Streak</span>
          </div>
          <div style={styles.streakItem}>
            <span style={styles.streakNumber}>{streak?.totalLogins || 0}</span>
            <span style={styles.streakLabel}>Total Logins</span>
          </div>
        </div>

        <div style={styles.streakBonuses}>
          <h4 style={styles.streakBonusesTitle}>Streak Bonuses</h4>
          <ul style={styles.streakBonusesList}>
            <li style={{
              ...styles.streakBonusItem,
              ...((streak?.currentStreak || 0) >= 3 ? styles.completed : {}),
            }}>
              <span>3-day streak: +5 Gratonites</span>
              {(streak?.currentStreak || 0) >= 3 && <span style={styles.check}>&#10003;</span>}
            </li>
            <li style={{
              ...styles.streakBonusItem,
              ...((streak?.currentStreak || 0) >= 7 ? styles.completed : {}),
            }}>
              <span>7-day streak: +15 Gratonites</span>
              {(streak?.currentStreak || 0) >= 7 && <span style={styles.check}>&#10003;</span>}
            </li>
            <li style={{
              ...styles.streakBonusItemLast,
              ...((streak?.currentStreak || 0) >= 30 ? styles.completed : {}),
            }}>
              <span>30-day streak: +50 Gratonites</span>
              {(streak?.currentStreak || 0) >= 30 && <span style={styles.check}>&#10003;</span>}
            </li>
          </ul>
        </div>
      </div>

      {/* Message Milestones */}
      <div style={styles.card}>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Message Milestones</div>
          <div style={styles.fieldValue}>
            Send messages to earn bonus Gratonites!
          </div>
        </div>

        <div style={styles.milestones}>
          <div style={messageCount >= 100 ? styles.milestoneCompleted : styles.milestone}>
            <div style={styles.milestoneHeader}>
              <span>100 messages</span>
              <span style={styles.reward}>+20 G</span>
            </div>
            {messageCount < 100 && nextMilestone === 100 && (
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${progress}%` }} />
              </div>
            )}
          </div>

          <div style={messageCount >= 500 ? styles.milestoneCompleted : styles.milestone}>
            <div style={styles.milestoneHeader}>
              <span>500 messages</span>
              <span style={styles.reward}>+100 G</span>
            </div>
            {messageCount >= 100 && messageCount < 500 && nextMilestone === 500 && (
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${progress}%` }} />
              </div>
            )}
          </div>

          <div style={messageCount >= 1000 ? styles.milestoneCompleted : styles.milestone}>
            <div style={styles.milestoneHeader}>
              <span>1,000 messages</span>
              <span style={styles.reward}>+250 G</span>
            </div>
            {messageCount >= 500 && messageCount < 1000 && nextMilestone === 1000 && (
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${progress}%` }} />
              </div>
            )}
          </div>
        </div>

        <div style={styles.currentCount}>
          You've sent {messageCount.toLocaleString()} messages
        </div>
      </div>
    </section>
  );
}
