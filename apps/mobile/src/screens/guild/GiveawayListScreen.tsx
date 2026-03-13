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
import { giveaways as giveawaysApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { Giveaway } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'GiveawayList'>;

function getCountdown(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h left`;
  }
  return `${hours}h ${minutes}m left`;
}

export default function GiveawayListScreen({ route }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId } = route.params;
  const [giveawayList, setGiveawayList] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'active' | 'ended'>('active');
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchGiveaways = useCallback(async () => {
    try {
      const data = await giveawaysApi.list(guildId);
      setGiveawayList(data);
      setLoadError(null);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load giveaways';
        if (refreshing || giveawayList.length > 0) {
          toast.error(message);
        } else {
          setLoadError(message);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [giveawayList.length, guildId, refreshing, toast]);

  useEffect(() => {
    fetchGiveaways();
  }, [fetchGiveaways]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGiveaways();
  };

  const filtered = giveawayList.filter((g) =>
    filter === 'active' ? !g.ended : g.ended,
  );

  const handleEnter = async (giveaway: Giveaway) => {
    try {
      await giveawaysApi.enter(guildId, giveaway.id);
      setGiveawayList((prev) =>
        prev.map((g) =>
          g.id === giveaway.id
            ? { ...g, entered: true, entryCount: g.entryCount + 1 }
            : g,
        ),
      );
    } catch {
      toast.error('Failed to enter giveaway');
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    segmentRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...(neo ? { borderBottomWidth: 2 } : {}),
    },
    segment: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: neo ? 0 : borderRadius.full,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    segmentActive: {
      backgroundColor: colors.accentPrimary,
    },
    segmentText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: neo ? '700' : '600',
      ...(neo ? { textTransform: 'uppercase' } : {}),
    },
    segmentTextActive: {
      color: colors.white,
    },
    listContent: {
      paddingVertical: spacing.sm,
    },
    card: {
      marginHorizontal: spacing.lg,
      marginVertical: spacing.sm,
      backgroundColor: colors.bgElevated,
      borderRadius: neo ? 0 : borderRadius.lg,
      padding: spacing.lg,
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
    },
    title: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: neo ? '700' : '600',
      flex: 1,
    },
    prize: {
      color: colors.accentPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginTop: 2,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.md,
    },
    countdown: {
      color: colors.warning,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    countdownEnded: {
      color: colors.textMuted,
    },
    entryCount: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    enterButton: {
      marginTop: spacing.md,
      backgroundColor: colors.accentPrimary,
      paddingVertical: spacing.sm,
      borderRadius: neo ? 0 : borderRadius.md,
      alignItems: 'center',
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    enterButtonDisabled: {
      backgroundColor: colors.bgPrimary,
    },
    enterButtonText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: '700',
      ...(neo ? { textTransform: 'uppercase' } : {}),
    },
    enterButtonTextDisabled: {
      color: colors.textMuted,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderGiveaway = ({ item }: { item: Giveaway }) => {
    const ended = item.ended;
    const entered = item.entered;
    const countdown = ended ? 'Ended' : getCountdown(item.endsAt);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.prize}>
              <Ionicons name="gift-outline" size={14} color={colors.accentPrimary} />{' '}
              {item.prize}
            </Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.countdown, ended && styles.countdownEnded]}>
            {countdown}
          </Text>
          <Text style={styles.entryCount}>
            {item.entryCount} {item.entryCount === 1 ? 'entry' : 'entries'}
          </Text>
        </View>
        {!ended && (
          <TouchableOpacity
            style={[styles.enterButton, entered && styles.enterButtonDisabled]}
            onPress={() => !entered && handleEnter(item)}
            disabled={entered}
          >
            <Text style={[styles.enterButtonText, entered && styles.enterButtonTextDisabled]}>
              {entered ? 'Entered' : 'Enter'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) return <LoadingScreen />;

  if (loadError && giveawayList.length === 0) {
    return (
      <PatternBackground>
        <EmptyState
          icon="alert-circle-outline"
          title="Failed to load giveaways"
          subtitle={loadError}
          actionLabel="Retry"
          onAction={fetchGiveaways}
        />
      </PatternBackground>
    );
  }

  return (
    <PatternBackground>
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segment, filter === 'active' && styles.segmentActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.segmentText, filter === 'active' && styles.segmentTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, filter === 'ended' && styles.segmentActive]}
          onPress={() => setFilter('ended')}
        >
          <Text style={[styles.segmentText, filter === 'ended' && styles.segmentTextActive]}>
            Ended
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderGiveaway}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="gift-outline"
            title={filter === 'active' ? 'No active giveaways' : 'No ended giveaways'}
            subtitle={filter === 'active' ? 'Check back later for new giveaways' : 'Past giveaways will appear here'}
          />
        }
      />
    </PatternBackground>
  );
}
