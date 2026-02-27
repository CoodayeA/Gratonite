import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { CurrencyLedgerEntry } from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<CurrencyLedgerEntry['source'], string> = {
  chat_message: 'Chat Activity',
  server_engagement: 'Server Activity',
  daily_checkin: 'Daily Login',
  shop_purchase: 'Shop Purchase',
  creator_item_purchase: 'Creator Item',
};

const MESSAGE_MILESTONES = [100, 500, 1_000, 5_000, 10_000] as const;

const MILESTONE_LABELS: Record<number, string> = {
  100: '100',
  500: '500',
  1_000: '1K',
  5_000: '5K',
  10_000: '10K',
};

function formatBalance(n: number): string {
  return n.toLocaleString();
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  return formatDate(iso);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
    padding: '32px 48px',
    overflowY: 'auto',
    height: '100%',
  } as React.CSSProperties,

  /* Header row */
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  } as React.CSSProperties,

  title: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  } as React.CSSProperties,

  exchangeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,

  exchangeLabel: {
    fontSize: 13,
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  exchangeValue: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--accent)',
  } as React.CSSProperties,

  /* Top two-column row */
  topRow: {
    display: 'flex',
    gap: 20,
    width: '100%',
  } as React.CSSProperties,

  /* Balance card */
  balCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '28px 32px',
    borderRadius: 'var(--radius-lg)',
    background: 'linear-gradient(180deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.03) 100%)',
    border: '1px solid rgba(212,175,55,0.25)',
  } as React.CSSProperties,

  balLabel: {
    fontSize: 14,
    color: 'var(--text-muted)',
  } as React.CSSProperties,

  balValueRow: {
    display: 'flex',
    alignItems: 'end',
    gap: 12,
  } as React.CSSProperties,

  balNumber: {
    fontSize: 40,
    fontWeight: 700,
    color: '#e8c547',
    lineHeight: 1,
  } as React.CSSProperties,

  balUnit: {
    fontSize: 18,
    fontWeight: 500,
    color: 'var(--accent)',
    paddingBottom: 4,
  } as React.CSSProperties,

  balChange: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: '#6aea8a',
  } as React.CSSProperties,

  /* Daily Rewards card */
  dailyCard: {
    width: 360,
    minWidth: 360,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '24px 28px',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
  } as React.CSSProperties,

  dailyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  } as React.CSSProperties,

  dailyDesc: {
    fontSize: 13,
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  dailyProgressWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%',
  } as React.CSSProperties,

  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 'var(--radius-pill)',
    background: '#25243a',
    position: 'relative',
    overflow: 'hidden',
  } as React.CSSProperties,

  progressFill: {
    height: '100%',
    borderRadius: 'var(--radius-pill)',
    background: 'linear-gradient(90deg, #d4af37, #e8c547)',
    position: 'absolute',
    left: 0,
    top: 0,
  } as React.CSSProperties,

  progressLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
  } as React.CSSProperties,

  progressCurrent: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--accent)',
  } as React.CSSProperties,

  progressMax: {
    fontSize: 12,
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  claimBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 40,
    borderRadius: 'var(--radius-md)',
    background: 'var(--accent)',
    color: '#1a1a2e',
    fontSize: 13,
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,

  claimBtnDisabled: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 40,
    borderRadius: 'var(--radius-md)',
    background: 'var(--text-faint)',
    color: '#1a1a2e',
    fontSize: 13,
    fontWeight: 700,
    border: 'none',
    cursor: 'not-allowed',
    opacity: 0.6,
  } as React.CSSProperties,

  /* Milestones section */
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  } as React.CSSProperties,

  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
  } as React.CSSProperties,

  mileGrid: {
    display: 'flex',
    gap: 12,
    width: '100%',
  } as React.CSSProperties,

  mileCard: (completed: boolean, inProgress: boolean) =>
    ({
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      padding: '14px 16px',
      borderRadius: 10,
      background: 'var(--bg-elevated)',
      border: `1px solid ${completed ? 'rgba(74,138,90,0.25)' : inProgress ? 'rgba(212,175,55,0.25)' : 'var(--stroke)'}`,
    }) as React.CSSProperties,

  mileValue: (completed: boolean, inProgress: boolean) =>
    ({
      fontSize: 16,
      fontWeight: 700,
      color: completed ? '#6aea8a' : inProgress ? 'var(--accent)' : 'var(--text-faint)',
    }) as React.CSSProperties,

  mileLabel: {
    fontSize: 11,
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  mileProgressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 'var(--radius-pill)',
    background: '#25243a',
    position: 'relative',
    overflow: 'hidden',
  } as React.CSSProperties,

  mileProgressFill: (completed: boolean, pct: number) =>
    ({
      height: '100%',
      borderRadius: 'var(--radius-pill)',
      background: completed ? '#6aea8a' : 'var(--accent)',
      position: 'absolute',
      left: 0,
      top: 0,
      width: `${pct}%`,
    }) as React.CSSProperties,

  /* Quick Actions */
  quickActionsRow: {
    display: 'flex',
    gap: 12,
    width: '100%',
  } as React.CSSProperties,

  quickActionCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: '16px 12px',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-elevated, #353348)',
    border: '1px solid var(--stroke)',
    cursor: 'pointer',
  } as React.CSSProperties,

  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'rgba(212,175,55,0.13)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  } as React.CSSProperties,

  quickActionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
  } as React.CSSProperties,

  /* Recent Transactions unified list */
  txCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-elevated, #353348)',
    border: '1px solid var(--stroke)',
    overflow: 'hidden',
  } as React.CSSProperties,

  txHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--stroke)',
  } as React.CSSProperties,

  txHeaderTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  } as React.CSSProperties,

  txRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderBottom: '1px solid var(--stroke)',
  } as React.CSSProperties,

  txLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  } as React.CSSProperties,

  txTextCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  } as React.CSSProperties,

  txName: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text)',
  } as React.CSSProperties,

  txDate: {
    fontSize: 11,
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  txAmountEarn: {
    fontSize: 14,
    fontWeight: 600,
    color: '#6aea8a',
  } as React.CSSProperties,

  txAmountSpend: {
    fontSize: 14,
    fontWeight: 600,
    color: '#e85a6e',
  } as React.CSSProperties,

  /* Ways to Earn */
  waysGrid: {
    display: 'flex',
    gap: 16,
    width: '100%',
  } as React.CSSProperties,

  wayCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '20px 18px',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
  } as React.CSSProperties,

  wayIcon: {
    fontSize: 28,
    color: 'var(--accent)',
  } as React.CSSProperties,

  wayTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
  } as React.CSSProperties,

  wayDesc: {
    fontSize: 12,
    color: 'var(--text-faint)',
    textAlign: 'center',
  } as React.CSSProperties,

  /* History columns */
  histRow: {
    display: 'flex',
    gap: 20,
    width: '100%',
  } as React.CSSProperties,

  histCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '20px 24px',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
  } as React.CSSProperties,

  histTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  } as React.CSSProperties,

  histEntry: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  } as React.CSSProperties,

  histEntryLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,

  histIconWrap: (variant: 'earn' | 'spend') =>
    ({
      width: 32,
      height: 32,
      borderRadius: 'var(--radius-md)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: variant === 'earn' ? 'rgba(74,138,90,0.13)' : 'rgba(106,42,58,0.19)',
      fontSize: 14,
    }) as React.CSSProperties,

  histTextCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  } as React.CSSProperties,

  histName: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text)',
  } as React.CSSProperties,

  histTime: {
    fontSize: 11,
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  histAmount: (variant: 'earn' | 'spend') =>
    ({
      fontSize: 14,
      fontWeight: 600,
      color: variant === 'earn' ? '#6aea8a' : '#e85a6e',
    }) as React.CSSProperties,

  emptyText: {
    fontSize: 13,
    color: 'var(--text-faint)',
    fontStyle: 'italic',
  } as React.CSSProperties,

  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-muted)',
    fontSize: 15,
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Source icon mapping
// ---------------------------------------------------------------------------

const SOURCE_ICONS: Record<CurrencyLedgerEntry['source'], string> = {
  chat_message: '\uD83D\uDCAC',
  server_engagement: '\uD83C\uDF1F',
  daily_checkin: '\uD83D\uDCC5',
  shop_purchase: '\uD83D\uDED2',
  creator_item_purchase: '\uD83C\uDFA8',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BalanceCard({
  balance,
  lifetimeEarned,
  lifetimeSpent,
}: {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
}) {
  // Compute a weekly change approximation from lifetime
  const weeklyChange = Math.max(0, lifetimeEarned - lifetimeSpent);
  return (
    <div style={s.balCard}>
      <span style={s.balLabel}>Your Balance</span>
      <div style={s.balValueRow}>
        <span style={s.balNumber}>{formatBalance(balance)}</span>
        <span style={s.balUnit}>Gratonite</span>
      </div>
      <div style={s.balChange}>
        <span>{'\u2191'}</span>
        <span>Earned {formatBalance(lifetimeEarned)} lifetime &middot; Spent {formatBalance(lifetimeSpent)}</span>
      </div>
    </div>
  );
}

function DailyRewardsCard() {
  const queryClient = useQueryClient();
  const claimMutation = useMutation({
    mutationFn: () => api.economy.claimReward({ source: 'daily_checkin' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['economy'] });
    },
  });

  // Streak is illustrative since the API doesn't expose it; show claim button
  const streakDays = 5; // placeholder until API provides streak
  const streakMax = 7;
  const pct = (streakDays / streakMax) * 100;

  return (
    <div style={s.dailyCard}>
      <h3 style={s.dailyTitle}>Daily Rewards</h3>
      <span style={s.dailyDesc}>Claim your Gratonite bonus (refreshes every 2 hours)</span>
      <div style={s.dailyProgressWrap}>
        <div style={s.progressTrack}>
          <div style={{ ...s.progressFill, width: `${pct}%` }} />
        </div>
        <div style={s.progressLabels}>
          <span style={s.progressCurrent}>{streakDays}/{streakMax} days</span>
          <span style={s.progressMax}>500 G bonus</span>
        </div>
      </div>
      <button
        style={claimMutation.isPending || claimMutation.isSuccess ? s.claimBtnDisabled : s.claimBtn}
        disabled={claimMutation.isPending || claimMutation.isSuccess}
        onClick={() => claimMutation.mutate()}
        type="button"
      >
        {claimMutation.isPending
          ? 'Claiming...'
          : claimMutation.isSuccess
          ? '\u2713 Claimed!'
          : "Claim Today's Reward"}
      </button>
      {claimMutation.isError && (
        <span style={{ fontSize: 12, color: 'var(--danger, #e85a6e)', textAlign: 'center' as const }}>
          {(claimMutation.error as any)?.message?.includes('too soon') || (claimMutation.error as any)?.code === 'TOO_SOON'
            ? 'Already claimed \u2014 check back in 2 hours'
            : 'Reward already claimed or unavailable'}
        </span>
      )}
    </div>
  );
}

function EarningMilestones({ messageCount }: { messageCount: number }) {
  return (
    <section style={s.section}>
      <h3 style={s.sectionTitle}>Earning Milestones</h3>
      <div style={s.mileGrid}>
        {MESSAGE_MILESTONES.map((milestone) => {
          const completed = messageCount >= milestone;
          const progress = completed ? 100 : Math.min((messageCount / milestone) * 100, 100);
          const inProgress = !completed && progress > 0;
          const label = MILESTONE_LABELS[milestone] ?? milestone.toLocaleString();

          return (
            <div key={milestone} style={s.mileCard(completed, inProgress)}>
              {completed ? (
                <span style={{ color: '#6aea8a', fontSize: 20 }}>{'\u2713'}</span>
              ) : (
                <div style={s.mileProgressTrack}>
                  <div style={s.mileProgressFill(completed, progress)} />
                </div>
              )}
              <span style={s.mileValue(completed, inProgress)}>{label}</span>
              <span style={s.mileLabel}>messages</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const WAYS_TO_EARN = [
  { icon: '\uD83D\uDCAC', title: 'Send Messages', desc: '1G per 5 messages' },
  { icon: '\uD83D\uDCC5', title: 'Daily Login', desc: '10G per day' },
  { icon: '\uD83E\uDD1D', title: 'Invite Friends', desc: '50G per invite' },
  { icon: '\u2728', title: 'Complete Profile', desc: '25G one-time' },
] as const;

function WaysToEarn() {
  return (
    <section style={s.section}>
      <h3 style={s.sectionTitle}>Ways to Earn</h3>
      <div style={s.waysGrid}>
        {WAYS_TO_EARN.map((card) => (
          <div key={card.title} style={s.wayCard}>
            <span style={s.wayIcon}>{card.icon}</span>
            <span style={s.wayTitle}>{card.title}</span>
            <span style={s.wayDesc}>{card.desc}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function HistorySection({ entries }: { entries: CurrencyLedgerEntry[] }) {
  const earnEntries = entries.filter((e) => e.direction === 'earn').slice(0, 5);
  const spendEntries = entries.filter((e) => e.direction === 'spend').slice(0, 5);

  return (
    <div style={s.histRow}>
      {/* Earn History */}
      <div style={s.histCard}>
        <h3 style={s.histTitle}>Earn History</h3>
        {earnEntries.length === 0 ? (
          <span style={s.emptyText}>No earnings yet.</span>
        ) : (
          earnEntries.map((entry) => (
            <div key={entry.id} style={s.histEntry}>
              <div style={s.histEntryLeft}>
                <div style={s.histIconWrap('earn')}>
                  {SOURCE_ICONS[entry.source] ?? '\uD83D\uDCB0'}
                </div>
                <div style={s.histTextCol as React.CSSProperties}>
                  <span style={s.histName}>
                    {entry.description || SOURCE_LABELS[entry.source] || entry.source}
                  </span>
                  <span style={s.histTime}>{formatRelativeTime(entry.createdAt)}</span>
                </div>
              </div>
              <span style={s.histAmount('earn')}>+{formatBalance(entry.amount)} G</span>
            </div>
          ))
        )}
      </div>

      {/* Spend History */}
      <div style={s.histCard}>
        <h3 style={s.histTitle}>Spend History</h3>
        {spendEntries.length === 0 ? (
          <span style={s.emptyText}>No purchases yet.</span>
        ) : (
          spendEntries.map((entry) => (
            <div key={entry.id} style={s.histEntry}>
              <div style={s.histEntryLeft}>
                <div style={s.histIconWrap('spend')}>
                  {SOURCE_ICONS[entry.source] ?? '\uD83D\uDCB0'}
                </div>
                <div style={s.histTextCol as React.CSSProperties}>
                  <span style={s.histName}>
                    {entry.description || SOURCE_LABELS[entry.source] || entry.source}
                  </span>
                  <span style={s.histTime}>{formatRelativeTime(entry.createdAt)}</span>
                </div>
              </div>
              <span style={s.histAmount('spend')}>-{formatBalance(entry.amount)} G</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GratoniteDashboard() {
  const [quickNotice, setQuickNotice] = useState<string | null>(null);

  const {
    data: wallet,
    isLoading: walletLoading,
    isError: walletError,
  } = useQuery({
    queryKey: ['economy', 'wallet'],
    queryFn: () => api.economy.getWallet(),
  });

  const {
    data: ledger = [],
    isLoading: ledgerLoading,
  } = useQuery({
    queryKey: ['economy', 'ledger'],
    queryFn: () => api.economy.getLedger(50),
  });

  const {
    data: me,
    isLoading: meLoading,
  } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => api.users.getMe(),
  });

  const isLoading = walletLoading || ledgerLoading || meLoading;

  if (isLoading) {
    return (
      <div style={s.loading}>
        Loading Gratonite dashboard...
      </div>
    );
  }

  if (walletError) {
    return (
      <div style={s.loading}>
        Failed to load wallet data. Please try again later.
      </div>
    );
  }

  const pricePerG = 0.012;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <h2 style={s.title}>Gratonite Wallet</h2>
        <div style={s.exchangeRow}>
          <span style={s.exchangeLabel}>1 G =</span>
          <span style={s.exchangeValue}>${pricePerG.toFixed(3)} USD</span>
        </div>
      </div>

      {/* Balance + Daily Rewards row */}
      <div style={s.topRow}>
        <BalanceCard
          balance={wallet?.balance ?? 0}
          lifetimeEarned={wallet?.lifetimeEarned ?? 0}
          lifetimeSpent={wallet?.lifetimeSpent ?? 0}
        />
        <DailyRewardsCard />
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={s.quickActionsRow}>
          {([
            { icon: '\u{1F4E4}', label: 'Send', onClick: () => setQuickNotice('Send Gratonite \u2014 coming soon!') },
            { icon: '\u{1F4E5}', label: 'Receive', onClick: () => setQuickNotice('Receive Gratonite \u2014 coming soon!') },
            { icon: '\uD83D\uDED2', label: 'Buy', onClick: () => setQuickNotice('Buy Gratonite \u2014 coming soon!') },
            { icon: '\uD83D\uDCCB', label: 'History', onClick: () => {
              setQuickNotice(null);
              document.getElementById('tx-history')?.scrollIntoView({ behavior: 'smooth' });
            }},
          ] as const).map((action) => (
            <button
              key={action.label}
              type="button"
              style={{ ...s.quickActionCard, border: 'none' } as React.CSSProperties}
              onClick={action.onClick}
            >
              <div style={s.quickActionIcon}>{action.icon}</div>
              <span style={s.quickActionLabel}>{action.label}</span>
            </button>
          ))}
        </div>
        {quickNotice && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' as const, padding: '4px 0' }}>
            {quickNotice}
            <button
              type="button"
              onClick={() => setQuickNotice(null)}
              style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              &times;
            </button>
          </div>
        )}
      </div>

      {/* Recent Transactions (unified) */}
      {ledger.length > 0 && (
        <section style={s.section}>
          <div style={s.txCard}>
            <div style={s.txHeader}>
              <h3 style={s.txHeaderTitle}>Recent Transactions</h3>
            </div>
            {ledger.slice(0, 8).map((entry) => (
              <div key={entry.id} style={s.txRow}>
                <div style={s.txLeft}>
                  <div style={s.histIconWrap(entry.direction === 'earn' ? 'earn' : 'spend')}>
                    {SOURCE_ICONS[entry.source] ?? '\uD83D\uDCB0'}
                  </div>
                  <div style={s.txTextCol}>
                    <span style={s.txName}>{entry.description || SOURCE_LABELS[entry.source] || entry.source}</span>
                    <span style={s.txDate}>{formatRelativeTime(entry.createdAt)}</span>
                  </div>
                </div>
                <span style={entry.direction === 'earn' ? s.txAmountEarn : s.txAmountSpend}>
                  {entry.direction === 'earn' ? '+' : '-'}{formatBalance(entry.amount)} G
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Milestones */}
      <EarningMilestones messageCount={me?.profile?.messageCount ?? 0} />

      {/* Ways to Earn */}
      <WaysToEarn />

      {/* Earn / Spend History */}
      <div id="tx-history">
        <HistorySection entries={ledger} />
      </div>
    </div>
  );
}
