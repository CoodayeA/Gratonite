import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { studyRooms } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import LoadErrorCard from '../../components/LoadErrorCard';
import Avatar from '../../components/Avatar';
import type { StudyLeaderboardEntry } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'StudyLeaderboard'>;

const PERIODS = [
  { label: 'Week', value: 'week' as const },
  { label: 'Month', value: 'month' as const },
  { label: 'All Time', value: 'all' as const },
];

const RANK_COLORS: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };

export default function StudyLeaderboardScreen({ route }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId } = route.params;
  const [entries, setEntries] = useState<StudyLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');

  const fetchData = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await studyRooms.leaderboard(guildId, period);
      setEntries(data);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load leaderboard';
        if (refreshing || entries.length > 0) {
          toast.error(message);
        } else {
          setLoadError(message);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId, period]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    tabRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm, borderBottomWidth: neo ? 2 : 1, borderBottomColor: colors.border },
    tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: neo ? 0 : borderRadius.full, backgroundColor: colors.bgElevated, alignItems: 'center', ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    tabActive: { backgroundColor: colors.accentPrimary },
    tabText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: neo ? '700' : '600', ...(neo ? { textTransform: 'uppercase' } : {}) },
    tabTextActive: { color: colors.white },
    entryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: neo ? 2 : 1, borderBottomColor: colors.border, gap: spacing.md },
    rankContainer: { width: 32, alignItems: 'center' },
    rankText: { fontSize: fontSize.md, fontWeight: '700', color: colors.textSecondary },
    userInfo: { flex: 1, gap: 2 },
    displayName: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: neo ? '700' : '600' },
    username: { color: colors.textMuted, fontSize: fontSize.xs },
    scoreContainer: { backgroundColor: colors.bgElevated, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: neo ? 0 : borderRadius.md, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    scoreText: { color: colors.accentPrimary, fontSize: fontSize.sm, fontWeight: '700' },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  if (loadError && entries.length === 0) return <LoadErrorCard title="Failed to load leaderboard" message={loadError} onRetry={() => { setLoading(true); fetchData(); }} />;

  return (
    <PatternBackground>
      <View style={styles.tabRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity key={p.value} style={[styles.tab, period === p.value && styles.tabActive]} onPress={() => setPeriod(p.value)}>
            <Text style={[styles.tabText, period === p.value && styles.tabTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => (
          <View style={styles.entryRow}>
            <View style={styles.rankContainer}>
              {item.rank <= 3 ? <Ionicons name="trophy" size={20} color={RANK_COLORS[item.rank]} /> : <Text style={styles.rankText}>{item.rank}</Text>}
            </View>
            <Avatar userId={item.userId} avatarHash={item.avatarHash} name={item.displayName || item.username} size={36} />
            <View style={styles.userInfo}>
              <Text style={styles.displayName} numberOfLines={1}>{item.displayName || item.username}</Text>
              <Text style={styles.username}>{item.sessionsCompleted} sessions</Text>
            </View>
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreText}>{Math.round(item.totalMinutes / 60)}h {item.totalMinutes % 60}m</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="timer-outline" title="No study data" subtitle="Start a study session to appear here" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.accentPrimary} />}
      />
    </PatternBackground>
  );
}
