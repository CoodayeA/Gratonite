import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { leaderboard as leaderboardApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import Avatar from '../../components/Avatar';
import type { LeaderboardEntry } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Leaderboard'>;

const PERIODS = [
  { label: 'Week', value: 'week' as const },
  { label: 'Month', value: 'month' as const },
  { label: 'All Time', value: 'all' as const },
];

const RANK_COLORS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
};

export default function LeaderboardScreen({ route }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId } = route.params;
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await leaderboardApi.get(guildId, period);
      setEntries(data);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load leaderboard');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId, period]);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    tabRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...(neo ? { borderBottomWidth: 2 } : {}),
    },
    tab: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: neo ? 0 : borderRadius.full,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    tabActive: {
      backgroundColor: colors.accentPrimary,
    },
    tabText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: neo ? '700' : '600',
      ...(neo ? { textTransform: 'uppercase' } : {}),
    },
    tabTextActive: {
      color: colors.white,
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
      ...(neo ? { borderBottomWidth: 2 } : {}),
    },
    rankContainer: {
      width: 32,
      alignItems: 'center',
    },
    rankText: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    userInfo: {
      flex: 1,
      gap: 2,
    },
    displayName: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: neo ? '700' : '600',
    },
    username: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    scoreContainer: {
      backgroundColor: colors.bgElevated,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: neo ? 0 : borderRadius.md,
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    scoreText: {
      color: colors.accentPrimary,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderEntry = ({ item }: { item: LeaderboardEntry }) => {
    const rankColor = RANK_COLORS[item.rank];
    const isTopThree = item.rank <= 3;

    return (
      <View style={styles.entryRow}>
        <View style={styles.rankContainer}>
          {isTopThree ? (
            <Ionicons name="trophy" size={20} color={rankColor} />
          ) : (
            <Text style={styles.rankText}>{item.rank}</Text>
          )}
        </View>
        <Avatar
          userId={item.userId}
          avatarHash={item.avatarHash}
          name={item.displayName || item.username}
          size={36}
        />
        <View style={styles.userInfo}>
          <Text style={styles.displayName} numberOfLines={1}>
            {item.displayName || item.username}
          </Text>
          {item.displayName && (
            <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
          )}
        </View>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>{item.score.toLocaleString()}</Text>
        </View>
      </View>
    );
  };

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[styles.tab, period === p.value && styles.tabActive]}
            onPress={() => setPeriod(p.value)}
          >
            <Text style={[styles.tabText, period === p.value && styles.tabTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.userId}
        renderItem={renderEntry}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="trophy-outline"
            title="No leaderboard data"
            subtitle="Activity will appear here over time"
          />
        }
      />
    </View>
  );
}
