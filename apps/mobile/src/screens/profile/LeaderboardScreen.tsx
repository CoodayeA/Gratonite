import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { leaderboardApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { colors, fontSize, spacing, radius } from '../../theme';

// ── Types ─────────────────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'all';

interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  avatarHash?: string | null;
  messageCount: number;
  gratonitesEarned: number;
  memberSince: string;
  rank: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getRankIcon(rank: number): string | null {
  switch (rank) {
    case 1:
      return '\uD83E\uDD47';
    case 2:
      return '\uD83E\uDD48';
    case 3:
      return '\uD83E\uDD49';
    default:
      return null;
  }
}

function getRankColor(rank: number): string {
  switch (rank) {
    case 1:
      return '#FFD700';
    case 2:
      return '#C0C0C0';
    case 3:
      return '#CD7F32';
    default:
      return colors.text.muted;
  }
}

function formatScore(score: number): string {
  if (score >= 10000) return `${(score / 1000).toFixed(1)}k`;
  return score.toLocaleString();
}

// ── Main Screen ───────────────────────────────────────────────────────────

// ── Podium Component ──────────────────────────────────────────────────────

function PodiumView({
  first,
  second,
  third,
}: {
  first: LeaderboardEntry;
  second: LeaderboardEntry;
  third: LeaderboardEntry;
}) {
  return (
    <View style={styles.podium}>
      {/* 2nd place */}
      <View style={[styles.podiumItem, styles.podiumSecond]}>
        <Avatar size={48} userId={second.userId} avatarHash={second.avatarHash ?? undefined} displayName={second.displayName} username={second.username} />
        <Text style={styles.podiumRank}>{'\uD83E\uDD48'}</Text>
        <Text style={styles.podiumName} numberOfLines={1}>
          {second.displayName}
        </Text>
        <Text style={styles.podiumScore}>
          {formatScore(second.messageCount)}
        </Text>
      </View>

      {/* 1st place */}
      <View style={[styles.podiumItem, styles.podiumFirst]}>
        <Avatar size={56} userId={first.userId} avatarHash={first.avatarHash ?? undefined} displayName={first.displayName} username={first.username} />
        <Text style={styles.podiumRank}>{'\uD83E\uDD47'}</Text>
        <Text style={styles.podiumName} numberOfLines={1}>
          {first.displayName}
        </Text>
        <Text style={[styles.podiumScore, { color: '#FFD700' }]}>
          {formatScore(first.messageCount)}
        </Text>
      </View>

      {/* 3rd place */}
      <View style={[styles.podiumItem, styles.podiumThird]}>
        <Avatar size={48} userId={third.userId} avatarHash={third.avatarHash ?? undefined} displayName={third.displayName} username={third.username} />
        <Text style={styles.podiumRank}>{'\uD83E\uDD49'}</Text>
        <Text style={styles.podiumName} numberOfLines={1}>
          {third.displayName}
        </Text>
        <Text style={styles.podiumScore}>
          {formatScore(third.messageCount)}
        </Text>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────

export function LeaderboardScreen() {
  const currentUser = useAuthStore((s) => s.user);
  const [period, setPeriod] = useState<Period>('week');
  const [refreshing, setRefreshing] = useState(false);

  // ── Data Fetching ─────────────────────────────────────────────────────

  const {
    data: entries = [],
    isLoading,
    refetch,
  } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', period],
    queryFn: () => leaderboardApi.get(period),
  });

  const myEntry = entries.find((e) => e.userId === currentUser?.id);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // ── Period tabs ─────────────────────────────────────────────────────

  const periods: { key: Period; label: string }[] = [
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'all', label: 'All Time' },
  ];

  // ── Render Entry ────────────────────────────────────────────────────

  const renderEntry = useCallback(
    ({ item }: { item: LeaderboardEntry }) => {
      const isCurrentUser = item.userId === currentUser?.id;
      const rankIcon = getRankIcon(item.rank);
      const rankColor = getRankColor(item.rank);

      return (
        <View
          style={[
            styles.entryCard,
            isCurrentUser && styles.entryCardHighlighted,
          ]}
        >
          {/* Rank */}
          <View style={styles.rankContainer}>
            {rankIcon ? (
              <Text style={styles.rankIcon}>{rankIcon}</Text>
            ) : (
              <Text style={[styles.rankNumber, { color: rankColor }]}>
                #{item.rank}
              </Text>
            )}
          </View>

          {/* Avatar */}
          <Avatar size={40} userId={item.userId} avatarHash={item.avatarHash ?? undefined} displayName={item.displayName} username={item.username} />

          {/* Info */}
          <View style={styles.entryInfo}>
            <Text
              style={[
                styles.entryName,
                isCurrentUser && styles.entryNameHighlighted,
              ]}
              numberOfLines={1}
            >
              {item.displayName}
              {isCurrentUser ? ' (You)' : ''}
            </Text>
            <Text style={styles.entryUsername}>@{item.username}</Text>
          </View>

          {/* Score */}
          <View style={styles.scoreContainer}>
            <Text
              style={[
                styles.scoreValue,
                item.rank <= 3 && { color: rankColor },
              ]}
            >
              {formatScore(item.messageCount)}
            </Text>
            <Text style={styles.scoreLabel}>msgs</Text>
          </View>
        </View>
      );
    },
    [currentUser?.id],
  );

  // ── Loading ─────────────────────────────────────────────────────────

  if (isLoading && entries.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Period Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
        style={styles.tabBarOuter}
      >
        {periods.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[
              styles.tabPill,
              period === p.key && styles.tabPillActive,
            ]}
            onPress={() => setPeriod(p.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabPillText,
                period === p.key && styles.tabPillTextActive,
              ]}
            >
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Leaderboard List */}
      <View style={styles.listContainer}>
        <FlashList
          data={entries}
          renderItem={renderEntry}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.brand.primary}
            />
          }
          ListHeaderComponent={
            // Top 3 podium (if enough entries)
            entries.length >= 3 ? (
              <PodiumView first={entries[0] as LeaderboardEntry} second={entries[1] as LeaderboardEntry} third={entries[2] as LeaderboardEntry} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>{'\uD83C\uDFC6'}</Text>
              <Text style={styles.emptyTitle}>No rankings yet</Text>
              <Text style={styles.emptySubtitle}>
                Be the first to earn points this period
              </Text>
            </View>
          }
        />
      </View>

      {/* Current User Rank (sticky bottom) */}
      {myEntry && (
        <View style={styles.userRankBar}>
          <Text style={styles.userRankLabel}>Your Rank</Text>
          <View style={styles.userRankInfo}>
            <Text style={styles.userRankPosition}>
              #{myEntry.rank}
            </Text>
            <Text style={styles.userRankScore}>
              {formatScore(myEntry.messageCount)} msgs
            </Text>
          </View>
        </View>
      )}
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

  // Tab bar
  tabBarOuter: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.primary,
  },
  tabBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tabPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bg.elevated,
  },
  tabPillActive: {
    backgroundColor: colors.brand.primary,
  },
  tabPillText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tabPillTextActive: {
    color: '#ffffff',
  },

  // List
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing['5xl'],
  },

  // Podium
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
  },
  podiumFirst: {
    marginBottom: spacing.lg,
  },
  podiumSecond: {},
  podiumThird: {},
  podiumAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  podiumAvatarFirst: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  podiumAvatarText: {
    color: colors.brand.primary,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  podiumRank: {
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  podiumName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    maxWidth: 100,
  },
  podiumScore: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
    marginTop: 2,
  },

  // Entry card
  entryCard: {
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
  entryCardHighlighted: {
    borderColor: colors.brand.primary,
    borderWidth: 1,
    backgroundColor: 'rgba(129, 140, 248, 0.06)',
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
  },
  rankIcon: {
    fontSize: 20,
  },
  rankNumber: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.brand.primary,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  entryNameHighlighted: {
    color: colors.brand.primary,
  },
  entryUsername: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginTop: 1,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text.primary,
  },
  scoreLabel: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },

  // User rank bar
  userRankBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.stroke.primary,
  },
  userRankLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  userRankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  userRankPosition: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.brand.primary,
  },
  userRankScore: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.muted,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing['3xl'],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
