import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { seasonalEvents } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { mediumImpact } from '../../lib/haptics';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { SeasonalEvent, SeasonalEventProgress } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'SeasonalEvents'>;

export default function SeasonalEventsScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [events, setEvents] = useState<Array<SeasonalEvent & { progress?: SeasonalEventProgress }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const activeEvents = await seasonalEvents.getActive();
      const withProgress = await Promise.all(
        activeEvents.map(async (event) => {
          try {
            const progress = await seasonalEvents.getProgress(event.id);
            return { ...event, progress };
          } catch {
            return event;
          }
        })
      );
      setEvents(withProgress);
    } catch {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleClaim = async (eventId: string, milestoneId: string) => {
    mediumImpact();
    try {
      await seasonalEvents.claimMilestone(eventId, milestoneId);
      toast.success('Reward claimed!');
      fetchData();
    } catch {
      toast.error('Failed to claim reward');
    }
  };

  const getTimeRemaining = (endDate: string) => {
    const diff = new Date(endDate).getTime() - Date.now();
    if (diff <= 0) return 'Ended';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    card: { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.bgElevated, borderRadius: neo ? 0 : borderRadius.lg, overflow: 'hidden', ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    cardBody: { padding: spacing.lg },
    eventName: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
    timerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
    timerText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textMuted },
    progressBar: { height: 8, backgroundColor: colors.bgPrimary, borderRadius: 4, marginTop: spacing.md, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: colors.accentPrimary, borderRadius: 4 },
    progressText: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs },
    milestonesLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
    milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
    milestoneName: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary },
    milestoneThreshold: { fontSize: fontSize.xs, color: colors.textMuted },
    claimBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: neo ? 0 : borderRadius.full, backgroundColor: colors.accentPrimary },
    claimBtnText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.white },
    claimedBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    claimedText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.success },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  return (
    <PatternBackground>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const progress = item.progress;
          const maxThreshold = Math.max(...(item.milestones ?? []).map(m => m.threshold), 1);
          const progressPct = progress ? Math.min((progress.points / maxThreshold) * 100, 100) : 0;

          return (
            <View style={styles.card}>
              <View style={styles.cardBody}>
                <Text style={styles.eventName}>{item.emoji ? `${item.emoji} ` : ''}{item.name}</Text>
                <View style={styles.timerRow}>
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.timerText}>Ends in {getTimeRemaining(item.endAt)}</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                </View>
                <Text style={styles.progressText}>{progress?.points ?? 0} / {maxThreshold} points</Text>

                <Text style={styles.milestonesLabel}>Milestones</Text>
                {(item.milestones ?? []).map((m) => {
                  const claimed = progress?.claimedRewards?.includes(m.id);
                  const canClaim = !claimed && (progress?.points ?? 0) >= m.threshold;
                  return (
                    <View key={m.id} style={styles.milestoneRow}>
                      <Ionicons name={claimed ? 'checkmark-circle' : canClaim ? 'gift-outline' : 'lock-closed-outline'} size={18} color={claimed ? colors.success : canClaim ? colors.accentPrimary : colors.textMuted} />
                      <Text style={styles.milestoneName}>{m.name}</Text>
                      <Text style={styles.milestoneThreshold}>{m.threshold}pts</Text>
                      {canClaim && (
                        <TouchableOpacity style={styles.claimBtn} onPress={() => handleClaim(item.id, m.id)}>
                          <Text style={styles.claimBtnText}>Claim</Text>
                        </TouchableOpacity>
                      )}
                      {claimed && (
                        <View style={styles.claimedBadge}>
                          <Text style={styles.claimedText}>Claimed</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<EmptyState icon="calendar-outline" title="No active events" subtitle="Check back later for seasonal events" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.accentPrimary} />}
      />
    </PatternBackground>
  );
}
