import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { activityLog as activityLogApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { ActivityLogEvent } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'ActivityLog'>;

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  member_join: 'person-add-outline',
  member_leave: 'person-remove-outline',
  message_send: 'chatbubble-outline',
  channel_create: 'add-circle-outline',
  channel_delete: 'trash-outline',
  role_update: 'shield-outline',
  settings_update: 'settings-outline',
  invite_use: 'link-outline',
  voice_join: 'mic-outline',
  voice_leave: 'mic-off-outline',
};

export default function ActivityLogScreen({ route }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [events, setEvents] = useState<ActivityLogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchEvents = useCallback(async (before?: string) => {
    try {
      const data = await activityLogApi.list(guildId, 50, before);
      if (before) {
        setEvents((prev) => [...prev, ...data]);
      } else {
        setEvents(data);
      }
      if (data.length < 50) setHasMore(false);
    } catch (err: any) {
      // silently ignore — empty state handles no data
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleLoadMore = () => {
    if (loadingMore || !hasMore || events.length === 0) return;
    setLoadingMore(true);
    const lastEvent = events[events.length - 1];
    fetchEvents(lastEvent.id);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    list: {
      paddingBottom: spacing.xxxl,
    },
    eventRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    eventIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    eventInfo: {
      flex: 1,
    },
    eventActor: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    eventDescription: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      marginTop: 2,
    },
    eventTime: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: spacing.xs,
    },
    loadingMore: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    loadingMoreText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  return (
    <PatternBackground>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => {
          const icon = TYPE_ICONS[item.type] || 'ellipse-outline';
          return (
            <View style={styles.eventRow}>
              <View style={styles.eventIcon}>
                <Ionicons name={icon} size={18} color={colors.textSecondary} />
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventActor}>{item.actorName || 'System'}</Text>
                <Text style={styles.eventDescription}>{item.description}</Text>
                <Text style={styles.eventTime}>{formatRelativeTime(item.createdAt)}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title="No activity"
            subtitle="Portal activity will appear here"
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <Text style={styles.loadingMoreText}>Loading more...</Text>
            </View>
          ) : null
        }
      />
    </PatternBackground>
  );
}
