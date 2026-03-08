import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { activityFeed } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import type { ActivityFeedItem } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ActivityFeed'>;

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  message: 'chatbubble-outline',
  guild_join: 'enter-outline',
  guild_leave: 'exit-outline',
  friend_add: 'person-add-outline',
  achievement: 'trophy-outline',
  level_up: 'arrow-up-circle-outline',
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ActivityFeedScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();

  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchItems = useCallback(async (reset = false) => {
    try {
      const res = await activityFeed.list(reset ? undefined : cursor || undefined);
      if (reset) {
        setItems(res.items);
      } else {
        setItems((prev) => [...prev, ...res.items]);
      }
      setCursor(res.nextCursor);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [cursor]);

  useEffect(() => {
    fetchItems(true);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setCursor(null);
    fetchItems(true);
  };

  const handleEndReached = () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    fetchItems(false);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    item: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      alignItems: 'center',
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.bgSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemContent: {
      flex: 1,
    },
    description: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      lineHeight: 20,
    },
    time: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    footer: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.md,
      textAlign: 'center',
      paddingVertical: spacing.xxxl,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderItem = ({ item }: { item: ActivityFeedItem }) => {
    const iconName = TYPE_ICONS[item.type] || 'ellipse-outline';
    return (
      <View style={styles.item}>
        <View style={styles.iconCircle}>
          <Ionicons name={iconName} size={18} color={colors.textSecondary} />
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.description}>{item.description}</Text>
          <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.accentPrimary}
        />
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.footer}>
            <ActivityIndicator size="small" color={colors.accentPrimary} />
          </View>
        ) : null
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>No activity yet</Text>
      }
    />
  );
}
