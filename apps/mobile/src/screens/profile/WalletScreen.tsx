import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { economyApi, usersApi } from '../../lib/api';
import { colors, fontSize, spacing, radius } from '../../theme';

// ── Types (matching actual API response) ─────────────────────────────────

interface Wallet {
  userId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string;
}

interface LedgerEntry {
  id: string;
  userId: string;
  direction: 'earn' | 'spend';
  amount: number;
  source: string;
  description?: string | null;
  contextKey?: string | null;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatBalance(n: number): string {
  return n.toLocaleString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const SOURCE_LABELS: Record<string, string> = {
  chat_message: 'Chat Reward',
  server_engagement: 'Server Activity',
  daily_checkin: 'Daily Login',
  shop_purchase: 'Shop Purchase',
  creator_item_purchase: 'Creator Item',
};

const SOURCE_ICONS: Record<string, string> = {
  chat_message: '\uD83D\uDCAC',
  server_engagement: '\uD83C\uDF99',
  daily_checkin: '\uD83D\uDCC5',
  shop_purchase: '\uD83D\uDED2',
  creator_item_purchase: '\u2728',
};

const MESSAGE_MILESTONES = [100, 500, 1_000, 5_000, 10_000] as const;

const WAYS_TO_EARN = [
  { icon: '\uD83D\uDCAC', title: 'Send Messages', desc: 'Earn \u20B22 for every few messages' },
  { icon: '\uD83D\uDCC5', title: 'Daily Login', desc: 'Claim \u20B220 every day' },
  { icon: '\uD83E\uDD1D', title: 'Invite Friends', desc: 'Earn \u20B250 per accepted invite' },
  { icon: '\u2728', title: 'Complete Profile', desc: 'Earn \u20B225 for a complete profile' },
] as const;

// ── Sub-components ────────────────────────────────────────────────────────

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
    <View style={styles.balanceCard}>
      <View style={styles.balanceHero}>
        <Text style={styles.currencySymbol}>{'\u20B2'}</Text>
        <Text style={styles.balanceNumber}>{formatBalance(balance)}</Text>
      </View>

      <View style={styles.balanceStats}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Lifetime Earned</Text>
          <Text style={[styles.statValue, styles.earnColor]}>
            {'\u20B2'}{formatBalance(lifetimeEarned)}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Lifetime Spent</Text>
          <Text style={[styles.statValue, styles.spendColor]}>
            {'\u20B2'}{formatBalance(lifetimeSpent)}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Balance</Text>
          <Text style={styles.statValue}>
            {'\u20B2'}{formatBalance(balance)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function EarningMilestones({ messageCount }: { messageCount: number }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Earning Milestones</Text>
      {MESSAGE_MILESTONES.map((milestone) => {
        const completed = messageCount >= milestone;
        const progress = completed ? 100 : Math.min((messageCount / milestone) * 100, 100);

        return (
          <View key={milestone} style={styles.milestoneRow}>
            <View style={styles.milestoneHeader}>
              <Text style={styles.milestoneLabel}>
                {completed ? '\u2713 ' : ''}
                {milestone.toLocaleString()} Messages
              </Text>
              <Text style={styles.milestoneCount}>
                {formatBalance(Math.min(messageCount, milestone))} / {formatBalance(milestone)}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  completed && styles.progressComplete,
                  { width: `${progress}%` },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function WaysToEarnSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Ways to Earn</Text>
      <View style={styles.earnGrid}>
        {WAYS_TO_EARN.map((card) => (
          <View key={card.title} style={styles.earnCard}>
            <Text style={styles.earnIcon}>{card.icon}</Text>
            <Text style={styles.earnCardTitle}>{card.title}</Text>
            <Text style={styles.earnCardDesc}>{card.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Sections as list data for FlashList ──────────────────────────────────

type SectionItem =
  | { type: 'balance'; wallet: Wallet }
  | { type: 'milestones'; messageCount: number }
  | { type: 'tx-header' }
  | { type: 'tx'; entry: LedgerEntry }
  | { type: 'tx-empty' }
  | { type: 'ways-to-earn' };

// ── Main Screen ───────────────────────────────────────────────────────────

export function WalletScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: wallet,
    isLoading: walletLoading,
    refetch: refetchWallet,
  } = useQuery<Wallet>({
    queryKey: ['economy-wallet'],
    queryFn: () => economyApi.getWallet(),
  });

  const {
    data: ledger = [],
    isLoading: ledgerLoading,
    refetch: refetchLedger,
  } = useQuery<LedgerEntry[]>({
    queryKey: ['economy-ledger'],
    queryFn: () => economyApi.getLedger(50),
  });

  const { data: me } = useQuery({
    queryKey: ['users-me'],
    queryFn: () => usersApi.getMe(),
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchWallet(), refetchLedger()]);
    setRefreshing(false);
  }, [refetchWallet, refetchLedger]);

  if (walletLoading && !wallet) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Build flat list of section items
  const items: SectionItem[] = [];
  items.push({
    type: 'balance',
    wallet: wallet ?? { userId: '', balance: 0, lifetimeEarned: 0, lifetimeSpent: 0, updatedAt: '' },
  });
  items.push({
    type: 'milestones',
    messageCount: me?.profile?.messageCount ?? me?.messageCount ?? 0,
  });
  items.push({ type: 'tx-header' });
  if (ledger.length === 0 && !ledgerLoading) {
    items.push({ type: 'tx-empty' });
  } else {
    for (const entry of ledger) {
      items.push({ type: 'tx', entry });
    }
  }
  items.push({ type: 'ways-to-earn' });

  const renderItem = ({ item }: { item: SectionItem }) => {
    switch (item.type) {
      case 'balance':
        return (
          <BalanceCard
            balance={item.wallet.balance}
            lifetimeEarned={item.wallet.lifetimeEarned}
            lifetimeSpent={item.wallet.lifetimeSpent}
          />
        );
      case 'milestones':
        return <EarningMilestones messageCount={item.messageCount} />;
      case 'tx-header':
        return (
          <View style={styles.txHeaderRow}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
          </View>
        );
      case 'tx': {
        const e = item.entry;
        const isEarn = e.direction === 'earn';
        return (
          <View style={styles.txCard}>
            <View style={styles.txIconContainer}>
              <Text style={styles.txIconText}>
                {SOURCE_ICONS[e.source] ?? '\uD83E\uDE99'}
              </Text>
            </View>
            <View style={styles.txContent}>
              <Text style={styles.txLabel}>
                {SOURCE_LABELS[e.source] ??
                  e.source
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
              </Text>
              {e.description ? (
                <Text style={styles.txDesc} numberOfLines={1}>
                  {e.description}
                </Text>
              ) : null}
              <Text style={styles.txDate}>{formatDate(e.createdAt)}</Text>
            </View>
            <Text
              style={[
                styles.txAmount,
                isEarn ? styles.earnColor : styles.spendColor,
              ]}
            >
              {isEarn ? '+' : '-'}{'\u20B2'}{Math.abs(e.amount)}
            </Text>
          </View>
        );
      }
      case 'tx-empty':
        return (
          <View style={styles.txEmpty}>
            <Text style={styles.txEmptyText}>No transactions yet</Text>
          </View>
        );
      case 'ways-to-earn':
        return <WaysToEarnSection />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Gratonite</Text>
      </View>
      <View style={styles.listWrapper}>
        <FlashList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item, index) => {
            if (item.type === 'tx') return `tx-${item.entry.id}`;
            return `${item.type}-${index}`;
          }}

          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.brand.primary}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  pageTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: colors.text.primary,
  },
  listWrapper: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
  },

  // Balance card
  balanceCard: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    marginBottom: spacing.xl,
  },
  balanceHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  currencySymbol: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.brand.primary,
  },
  balanceNumber: {
    fontSize: fontSize.title,
    fontWeight: '800',
    color: colors.text.primary,
  },
  balanceStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text.primary,
  },
  earnColor: {
    color: colors.accent.success,
  },
  spendColor: {
    color: colors.accent.error,
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },

  // Milestones
  milestoneRow: {
    marginBottom: spacing.md,
  },
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  milestoneLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.primary,
  },
  milestoneCount: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brand.primary,
    borderRadius: 4,
  },
  progressComplete: {
    backgroundColor: colors.accent.success,
  },

  // Transaction history
  txHeaderRow: {
    marginTop: spacing.sm,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke.primary,
    gap: spacing.md,
  },
  txIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconText: {
    fontSize: 18,
  },
  txContent: {
    flex: 1,
  },
  txLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
  },
  txDesc: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginTop: 1,
  },
  txDate: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  txAmount: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  txEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  txEmptyText: {
    fontSize: fontSize.md,
    color: colors.text.muted,
  },

  // Ways to earn
  earnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  earnCard: {
    width: '48%',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke.primary,
  },
  earnIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  earnCardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  earnCardDesc: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    lineHeight: 16,
  },
});
