import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { users, leaderboard } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import Avatar from '../../components/Avatar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import type { LeaderboardEntry } from '../../types';

type Props = NativeStackScreenProps<AppStackParamList, 'FameDashboard'>;

interface FameStats {
  fameReceived: number;
  fameGiven: number;
  remaining: number;
  used: number;
}

export default function FameDashboardScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const [stats, setStats] = useState<FameStats | null>(null);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [fameData, remainingData, leaderData] = await Promise.all([
        user ? users.getFame(user.id) : Promise.resolve({ fameReceived: 0, fameGiven: 0 }),
        users.getFameRemaining(),
        leaderboard.getGlobal('all'),
      ]);
      setStats({
        fameReceived: fameData.fameReceived,
        fameGiven: fameData.fameGiven,
        remaining: remainingData.remaining,
        used: remainingData.used,
      });
      setLeaders(leaderData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load fame data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: spacing.md,
    },
    statCard: {
      width: '50%',
      padding: spacing.xs,
    },
    statCardInner: {
      backgroundColor: colors.bgSecondary,
      borderRadius: neo ? 0 : borderRadius.lg || borderRadius.md,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.sm,
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    statIconCircle: {
      width: 48,
      height: 48,
      borderRadius: neo ? 0 : 24,
      backgroundColor: colors.accentPrimary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    statNumber: {
      fontSize: fontSize.xxl || 24,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    statLabel: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      fontWeight: '500',
      textAlign: 'center',
    },
    sectionHeader: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.textPrimary,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
      ...(neo ? { textTransform: 'uppercase' } : {}),
    },
    leaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    rankBadge: {
      width: 32,
      height: 32,
      borderRadius: neo ? 0 : 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rankText: {
      fontSize: fontSize.sm,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    leaderInfo: {
      flex: 1,
    },
    leaderName: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    leaderScore: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
      marginTop: 1,
    },
    scoreBadge: {
      backgroundColor: colors.accentPrimary + '15',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: neo ? 0 : borderRadius.sm,
    },
    scoreBadgeText: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: colors.accentPrimary,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: fontSize.md,
      paddingVertical: spacing.xxxl,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return <LoadingScreen />;
  }

  const STAT_ITEMS = [
    { key: 'received', label: 'Fame Received', value: stats?.fameReceived ?? 0, icon: 'star' as const, color: colors.warning || '#f59e0b' },
    { key: 'given', label: 'Fame Given', value: stats?.fameGiven ?? 0, icon: 'heart' as const, color: colors.error },
    { key: 'remaining', label: 'Remaining Today', value: stats?.remaining ?? 0, icon: 'flash' as const, color: colors.success },
    { key: 'used', label: 'Used Today', value: stats?.used ?? 0, icon: 'checkmark-circle' as const, color: colors.accentPrimary },
  ];

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return colors.bgElevated;
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.accentPrimary}
        />
      }
    >
      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {STAT_ITEMS.map((item) => (
          <View key={item.key} style={styles.statCard}>
            <View style={styles.statCardInner}>
              <View style={[styles.statIconCircle, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={styles.statNumber}>{item.value.toLocaleString()}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Leaderboard */}
      <Text style={styles.sectionHeader}>Global Leaderboard</Text>
      {leaders.length === 0 ? (
        <Text style={styles.emptyText}>No leaderboard data yet</Text>
      ) : (
        leaders.map((entry) => (
          <View key={entry.userId} style={styles.leaderRow}>
            <View style={[styles.rankBadge, { backgroundColor: getRankColor(entry.rank) }]}>
              <Text style={styles.rankText}>{entry.rank}</Text>
            </View>
            <Avatar
              userId={entry.userId}
              avatarHash={entry.avatarHash}
              name={entry.displayName || entry.username}
              size={40}
            />
            <View style={styles.leaderInfo}>
              <Text style={styles.leaderName} numberOfLines={1}>
                {entry.displayName || entry.username}
              </Text>
              <Text style={styles.leaderScore}>@{entry.username}</Text>
            </View>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreBadgeText}>{entry.score.toLocaleString()}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
