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
import { quests as questsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { Quest } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'QuestBoard'>;

export default function QuestBoardScreen({ route }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId } = route.params;
  const [questList, setQuestList] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'active' | 'completed'>('active');

  const fetchQuests = useCallback(async () => {
    try {
      const data = await questsApi.list(guildId);
      setQuestList(data);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load quests');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchQuests();
  }, [fetchQuests]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchQuests();
  };

  const filtered = questList.filter((q) =>
    tab === 'active' ? q.status === 'active' : q.status !== 'active',
  );

  const handleContribute = async (quest: Quest) => {
    try {
      const updated = await questsApi.contribute(guildId, quest.id);
      setQuestList((prev) => prev.map((q) => (q.id === quest.id ? updated : q)));
    } catch {
      toast.error('Failed to contribute');
    }
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
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.xs,
    },
    title: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: neo ? '700' : '600',
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: neo ? 0 : borderRadius.sm,
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    statusText: {
      fontSize: fontSize.xs,
      fontWeight: '700',
      ...(neo ? { textTransform: 'uppercase' } : {}),
    },
    description: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      marginBottom: spacing.md,
    },
    progressBarBg: {
      height: 8,
      backgroundColor: colors.bgPrimary,
      borderRadius: neo ? 0 : 4,
      overflow: 'hidden',
      ...(neo ? { borderWidth: 1, borderColor: colors.border } : {}),
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.accentPrimary,
      borderRadius: neo ? 0 : 4,
    },
    progressText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: spacing.xs,
    },
    rewardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    rewardText: {
      color: colors.accentPrimary,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    contributeButton: {
      marginTop: spacing.md,
      backgroundColor: colors.accentPrimary,
      paddingVertical: spacing.sm,
      borderRadius: neo ? 0 : borderRadius.md,
      alignItems: 'center',
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    contributeButtonText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: '700',
      ...(neo ? { textTransform: 'uppercase' } : {}),
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderQuest = ({ item }: { item: Quest }) => {
    const progress = item.goalAmount > 0 ? Math.min(item.currentAmount / item.goalAmount, 1) : 0;
    const isActive = item.status === 'active';

    const statusColor = isActive ? colors.success : colors.textMuted;

    return (
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}22` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status}
            </Text>
          </View>
        </View>
        {item.description && (
          <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
        )}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {item.currentAmount} / {item.goalAmount}
        </Text>
        {item.reward && (
          <View style={styles.rewardRow}>
            <Ionicons name="star" size={14} color={colors.accentPrimary} />
            <Text style={styles.rewardText}>{item.reward}</Text>
          </View>
        )}
        {isActive && (
          <TouchableOpacity style={styles.contributeButton} onPress={() => handleContribute(item)}>
            <Text style={styles.contributeButtonText}>Contribute</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) return <LoadingScreen />;

  return (
    <PatternBackground>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'active' && styles.tabActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'completed' && styles.tabActive]}
          onPress={() => setTab('completed')}
        >
          <Text style={[styles.tabText, tab === 'completed' && styles.tabTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderQuest}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="flag-outline"
            title={tab === 'active' ? 'No active quests' : 'No completed quests'}
            subtitle={tab === 'active' ? 'Quests will appear here when created' : 'Completed quests will show up here'}
          />
        }
      />
    </PatternBackground>
  );
}
