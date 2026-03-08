import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { notifications as notifApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import EmptyState from '../../components/EmptyState';
import LoadingScreen from '../../components/LoadingScreen';
import type { Notification } from '../../types';

const NOTIFICATION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  message: 'chatbubble',
  mention: 'at',
  friend_request: 'person-add',
  friend_accept: 'people',
  guild_invite: 'mail',
  system: 'information-circle',
};

const getNotificationIcon = (type: string): keyof typeof Ionicons.glyphMap => {
  return NOTIFICATION_ICONS[type] || 'notifications';
};

export default function NotificationInboxScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notifApi.list(50);
      setNotifications(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <TouchableOpacity onPress={handleMarkAllRead} style={{ padding: spacing.sm }}>
            <Ionicons name="checkmark-done" size={22} color={colors.accentPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClearAll} style={{ padding: spacing.sm, marginRight: spacing.xs }}>
            <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, colors, spacing]);

  const handleMarkRead = async (notificationId: string) => {
    try {
      await notifApi.markRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notifApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark all as read');
    }
  };

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    Alert.alert('Clear Notifications', 'Dismiss all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          try {
            await Promise.all(notifications.map((n) => notifApi.dismiss(n.id)));
            setNotifications([]);
            toast.success('Notifications cleared');
          } catch (err: any) {
            toast.error(err.message || 'Failed to clear notifications');
          }
        },
      },
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    list: {
      paddingTop: spacing.sm,
      flexGrow: 1,
    },
    notifItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    notifItemUnread: {
      backgroundColor: colors.accentLight,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    iconContainerUnread: {
      backgroundColor: colors.bgActive,
    },
    notifContent: {
      flex: 1,
    },
    notifHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    senderName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
      flex: 1,
    },
    notifTime: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginLeft: spacing.sm,
    },
    notifText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 18,
    },
    notifPreview: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
      fontStyle: 'italic',
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accentPrimary,
      marginTop: spacing.sm,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notifItem, !item.read && styles.notifItemUnread]}
      onPress={() => handleMarkRead(item.id)}
      activeOpacity={0.6}
    >
      <View style={[styles.iconContainer, !item.read && styles.iconContainerUnread]}>
        <Ionicons
          name={getNotificationIcon(item.type)}
          size={20}
          color={!item.read ? colors.accentPrimary : colors.textMuted}
        />
      </View>
      <View style={styles.notifContent}>
        <View style={styles.notifHeader}>
          {item.senderName && (
            <Text style={styles.senderName}>{item.senderName}</Text>
          )}
          <Text style={styles.notifTime}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.notifText} numberOfLines={2}>
          {item.content}
        </Text>
        {item.preview && (
          <Text style={styles.notifPreview} numberOfLines={1}>
            {item.preview}
          </Text>
        )}
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchNotifications(); }}
            tintColor={colors.accentPrimary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="No Notifications"
            subtitle="You're all caught up"
          />
        }
      />
    </View>
  );
}
