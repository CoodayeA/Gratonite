import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { CurrencyLedgerEntry } from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<CurrencyLedgerEntry['source'], string> = {
  chat_message: 'Chat Reward',
  server_engagement: 'Server Activity',
  daily_checkin: 'Daily Login',
  shop_purchase: 'Shop Purchase',
  creator_item_purchase: 'Creator Item',
};

const MESSAGE_MILESTONES = [100, 500, 1_000, 5_000, 10_000] as const;

function formatBalance(n: number): string {
  return n.toLocaleString();
}

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
  return (
    <section className="gd-balance-card">
      <div className="gd-balance-hero">
        <span className="gd-currency-symbol">{'\u20B2'}</span>
        <span className="gd-balance-number">{formatBalance(balance)}</span>
      </div>

      <div className="gd-balance-stats">
        <div className="gd-stat-box">
          <span className="gd-stat-label">Lifetime Earned</span>
          <span className="gd-stat-value gd-earn">{'\u20B2'}{formatBalance(lifetimeEarned)}</span>
        </div>
        <div className="gd-stat-box">
          <span className="gd-stat-label">Lifetime Spent</span>
          <span className="gd-stat-value gd-spend">{'\u20B2'}{formatBalance(lifetimeSpent)}</span>
        </div>
        <div className="gd-stat-box">
          <span className="gd-stat-label">Current Balance</span>
          <span className="gd-stat-value">{'\u20B2'}{formatBalance(balance)}</span>
        </div>
      </div>
    </section>
  );
}

function TransactionHistory({
  entries,
}: {
  entries: CurrencyLedgerEntry[];
}) {
  if (entries.length === 0) {
    return (
      <section className="gd-section">
        <h3 className="gd-section-title">Transaction History</h3>
        <p className="gd-empty">No transactions yet.</p>
      </section>
    );
  }

  return (
    <section className="gd-section">
      <h3 className="gd-section-title">Transaction History</h3>
      <div className="gd-transactions">
        {entries.map((entry) => (
          <div key={entry.id} className="gd-tx-row">
            <div className="gd-tx-left">
              <span className="gd-tx-date">{formatDate(entry.createdAt)}</span>
              <span className="gd-tx-desc">
                {entry.description || SOURCE_LABELS[entry.source] || entry.source}
              </span>
            </div>
            <span
              className={`gd-tx-amount ${entry.direction === 'earn' ? 'gd-earn' : 'gd-spend'}`}
            >
              {entry.direction === 'earn' ? '+' : '-'}{'\u20B2'}{formatBalance(entry.amount)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EarningMilestones({ messageCount }: { messageCount: number }) {
  return (
    <section className="gd-section">
      <h3 className="gd-section-title">Earning Milestones</h3>
      <div className="gd-milestones">
        {MESSAGE_MILESTONES.map((milestone) => {
          const completed = messageCount >= milestone;
          const progress = completed ? 100 : Math.min((messageCount / milestone) * 100, 100);

          return (
            <div key={milestone} className="gd-milestone-row">
              <div className="gd-milestone-header">
                <span className="gd-milestone-label">
                  {completed && <span className="gd-milestone-check">{'\u2713'} </span>}
                  {milestone.toLocaleString()} Messages
                </span>
                <span className="gd-milestone-count">
                  {formatBalance(Math.min(messageCount, milestone))} / {formatBalance(milestone)}
                </span>
              </div>
              <div className="gd-progress-track">
                <div
                  className={`gd-progress-fill${completed ? ' gd-progress-complete' : ''}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const WAYS_TO_EARN = [
  { icon: '\uD83D\uDCAC', title: 'Send Messages', desc: 'Earn \u20B21 for every 5 messages' },
  { icon: '\uD83D\uDCC5', title: 'Daily Login', desc: 'Claim \u20B210 every day' },
  { icon: '\uD83E\uDD1D', title: 'Invite Friends', desc: 'Earn \u20B250 per accepted invite' },
  { icon: '\u2728', title: 'Complete Profile', desc: 'Earn \u20B225 for a complete profile' },
] as const;

function WaysToEarn() {
  return (
    <section className="gd-section">
      <h3 className="gd-section-title">Ways to Earn</h3>
      <div className="gd-earn-grid">
        {WAYS_TO_EARN.map((card) => (
          <div key={card.title} className="gd-earn-card">
            <span className="gd-earn-icon">{card.icon}</span>
            <span className="gd-earn-title">{card.title}</span>
            <span className="gd-earn-desc">{card.desc}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GratoniteDashboard() {
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
      <div className="gratonite-dashboard">
        <div className="gd-loading">Loading Gratonite dashboard...</div>
      </div>
    );
  }

  if (walletError) {
    return (
      <div className="gratonite-dashboard">
        <div className="gd-loading">Failed to load wallet data. Please try again later.</div>
      </div>
    );
  }

  return (
    <div className="gratonite-dashboard">
      <h2 className="gd-page-title">Gratonite</h2>

      <BalanceCard
        balance={wallet?.balance ?? 0}
        lifetimeEarned={wallet?.lifetimeEarned ?? 0}
        lifetimeSpent={wallet?.lifetimeSpent ?? 0}
      />

      <EarningMilestones messageCount={me?.profile.messageCount ?? 0} />

      <TransactionHistory entries={ledger} />

      <WaysToEarn />
    </div>
  );
}
