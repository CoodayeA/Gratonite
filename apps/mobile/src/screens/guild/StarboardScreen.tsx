import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { starboard as starboardApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { StarboardEntry } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'Starboard'>;

export default function StarboardScreen({ route }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [entries, setEntries] = useState<StarboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const data = await starboardApi.getEntries(guildId);
      setEntries(data);
      setLoadError(null);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load starboard';
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
  }, [entries.length, guildId, refreshing, toast]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    list: {
      paddingVertical: spacing.sm,
      paddingBottom: spacing.xxxl,
    },
    entryRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    entryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    starBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.bgElevated,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    starCount: {
      color: colors.warning,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    authorName: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    channelName: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginLeft: 'auto',
    },
    contentPreview: {
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.warning,
      borderWidth: 1,
      borderColor: colors.border,
    },
    contentText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 20,
    },
    entryDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: spacing.sm,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  if (loadError && entries.length === 0) {
    return (
      <PatternBackground>
        <EmptyState
          icon="alert-circle-outline"
          title="Failed to load starboard"
          subtitle={loadError}
          actionLabel="Retry"
          onAction={fetchEntries}
        />
      </PatternBackground>
    );
  }

  return (
    <PatternBackground>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEntries(); }} tintColor={colors.accentPrimary} />
        }
        renderItem={({ item }) => (
          <View style={styles.entryRow}>
            <View style={styles.entryHeader}>
              <View style={styles.starBadge}>
                <Text>⭐</Text>
                <Text style={styles.starCount}>{item.starCount}</Text>
              </View>
              <Text style={styles.authorName}>{item.authorName || 'Unknown'}</Text>
              <Text style={styles.channelName}>#{item.channelId.slice(0, 8)}</Text>
            </View>
            <View style={styles.contentPreview}>
              <Text style={styles.contentText} numberOfLines={4}>{item.content}</Text>
            </View>
            <Text style={styles.entryDate}>{formatRelativeTime(item.createdAt)}</Text>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="star-outline"
            title="No starred messages"
            subtitle="Messages with enough stars will appear here"
          />
        }
      />
    </PatternBackground>
  );
}
