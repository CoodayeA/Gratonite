import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { notifications as notifApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme, useGlass } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import { lightImpact } from '../../lib/haptics';
import EmptyState from '../../components/EmptyState';
import LoadingScreen from '../../components/LoadingScreen';
import { onNotificationCreate } from '../../lib/socket';
import { useAppState } from '../../contexts/AppStateContext';
import type { Notification } from '../../types';
import PatternBackground from '../../components/PatternBackground';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppTabParamList, AppStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Notifications'>,
  NativeStackScreenProps<AppStackParamList>
>;

const NOTIFICATION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  message: 'chatbubble',
  mention: 'at',
  friend_request: 'person-add',
  friend_accept: 'people',
  guild_invite: 'mail',
  system: 'information-circle',
};

const NEO_PALETTE_KEYS = ['coral', 'mint', 'butter', 'lavender', 'sky', 'peach'] as const;

const getNotificationIcon = (type: string): keyof typeof Ionicons.glyphMap => {
  return NOTIFICATION_ICONS[type] || 'notifications';
};

export default function NotificationInboxScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const glassExtras = useGlass();
  const toast = useToast();
  const { refreshNotificationCount } = useAppState();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const activeSwipeableRef = useRef<Swipeable | null>(null);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const readNotifications = useMemo(
    () => notifications.filter((n) => n.read),
    [notifications],
  );

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
  }, [toast]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const unsub = onNotificationCreate(() => {
      fetchNotifications();
      refreshNotificationCount().catch(() => {});
    });
    return unsub;
  }, [fetchNotifications, refreshNotificationCount]);

  const handleMarkRead = async (notificationId: string) => {
    try {
      await notifApi.markRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
      refreshNotificationCount().catch(() => {});
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark notification as read');
    }
  };

  const handleDismiss = async (notificationId: string) => {
    lightImpact();
    try {
      await notifApi.dismiss(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      refreshNotificationCount().catch(() => {});
    } catch (err: any) {
      toast.error(err.message || 'Failed to dismiss notification');
    }
  };

  const handleSwipeMarkRead = async (notificationId: string) => {
    lightImpact();
    await handleMarkRead(notificationId);
    activeSwipeableRef.current?.close();
  };

  const handleMarkAllRead = useCallback(async () => {
    try {
      await notifApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      refreshNotificationCount().catch(() => {});
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark all as read');
    }
  }, [toast, refreshNotificationCount]);

  const handleClearAll = useCallback(() => {
    if (notifications.length === 0) return;
    Alert.alert('Clear Notifications', 'Dismiss all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          try {
            const batchSize = 10;
            for (let i = 0; i < notifications.length; i += batchSize) {
              await Promise.all(notifications.slice(i, i + batchSize).map((n) => notifApi.dismiss(n.id)));
            }
            setNotifications([]);
            refreshNotificationCount().catch(() => {});
            toast.success('Notifications cleared');
          } catch (err: any) {
            toast.error(err.message || 'Failed to clear notifications');
          }
        },
      },
    ]);
  }, [notifications, toast, refreshNotificationCount]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <TouchableOpacity onPress={handleMarkAllRead} style={{ padding: spacing.sm }} accessibilityLabel="Mark all as read">
            <Ionicons name="checkmark-done" size={22} color={colors.accentPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClearAll} style={{ padding: spacing.sm, marginRight: spacing.xs }} accessibilityLabel="Clear all notifications">
            <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, colors, spacing, handleMarkAllRead, handleClearAll]);

  const handleClearRead = () => {
    if (readNotifications.length === 0) return;
    Alert.alert('Clear Read Alerts', 'Dismiss all read alerts and keep unread ones?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear Read',
        style: 'destructive',
        onPress: async () => {
          try {
            const batchSize = 10;
            for (let i = 0; i < readNotifications.length; i += batchSize) {
              await Promise.all(readNotifications.slice(i, i + batchSize).map((n) => notifApi.dismiss(n.id)));
            }
            setNotifications((prev) => prev.filter((n) => !n.read));
            refreshNotificationCount().catch(() => {});
            toast.success('Read alerts cleared');
          } catch (err: any) {
            toast.error(err.message || 'Failed to clear read alerts');
          }
        },
      },
    ]);
  };

  const onSwipeableWillOpen = (notifId: string) => {
    const opening = swipeableRefs.current.get(notifId);
    if (activeSwipeableRef.current && activeSwipeableRef.current !== opening) {
      activeSwipeableRef.current.close();
    }
    activeSwipeableRef.current = opening ?? null;
  };

  const actionBorderRadius = neo ? 0 : borderRadius.md;
  const deleteActionBg = glassExtras ? 'rgba(239, 68, 68, 0.75)' : '#ef4444';
  const readActionBg = glassExtras
    ? (colors.accentPrimary + 'BF') // accent at 75% opacity
    : colors.accentPrimary;

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
      ...(glassExtras ? {
        backgroundColor: glassExtras.glassBackground,
        borderWidth: 1,
        borderColor: glassExtras.glassBorder,
        borderRadius: borderRadius.md,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
      } : neo ? {
        borderWidth: neo.borderWidth,
        borderColor: neo.shadowColor,
        borderRadius: 0,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
      } : {
        borderRadius: borderRadius.md,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        backgroundColor: colors.bgSecondary,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
      }),
    },
    notifItemUnread: {
      borderLeftWidth: 3,
      borderLeftColor: colors.accentPrimary,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: neo ? 0 : 18,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    iconContainerUnread: {
      backgroundColor: colors.accentPrimary + '1A', // accent at 10% opacity
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
      ...(glassExtras ? { textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 } : {}),
    },
    notifTime: {
      color: glassExtras ? colors.textPrimary : colors.textMuted,
      fontSize: fontSize.xs,
      marginLeft: spacing.sm,
    },
    notifText: {
      color: glassExtras ? colors.textPrimary : colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 18,
    },
    notifPreview: {
      color: glassExtras ? colors.textSecondary : colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
      fontStyle: 'italic',
    },
    unreadDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.accentPrimary,
      marginTop: spacing.sm,
      shadowColor: colors.accentPrimary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 4,
      elevation: 4,
    },
    swipeAction: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 80,
      marginBottom: spacing.sm,
    },
    swipeActionDelete: {
      backgroundColor: deleteActionBg,
      borderTopRightRadius: actionBorderRadius,
      borderBottomRightRadius: actionBorderRadius,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: neo.shadowColor, borderLeftWidth: 0 } : {}),
    },
    swipeActionRead: {
      backgroundColor: readActionBg,
      borderTopLeftRadius: actionBorderRadius,
      borderBottomLeftRadius: actionBorderRadius,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: neo.shadowColor, borderRightWidth: 0 } : {}),
    },
    swipeActionLabel: {
      color: '#fff',
      fontSize: fontSize.xs,
      fontWeight: '600',
      marginTop: 4,
    },
    bulkActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    bulkButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: glassExtras ? glassExtras.glassBackground : colors.bgSecondary,
      ...(glassExtras ? {
        borderWidth: 1,
        borderColor: glassExtras.glassBorder,
      } : neo ? {
        borderWidth: neo.borderWidth,
        borderColor: neo.shadowColor,
      } : {}),
    },
    bulkButtonDisabled: {
      opacity: 0.45,
    },
    bulkButtonText: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo, glassExtras, deleteActionBg, readActionBg, actionBorderRadius]);

  const renderRightActions = (notificationId: string) => () => (
    <TouchableOpacity
      style={[styles.swipeAction, styles.swipeActionDelete]}
      onPress={() => handleDismiss(notificationId)}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text style={styles.swipeActionLabel}>Delete</Text>
    </TouchableOpacity>
  );

  const renderLeftActions = (notificationId: string) => () => (
    <TouchableOpacity
      style={[styles.swipeAction, styles.swipeActionRead]}
      onPress={() => handleSwipeMarkRead(notificationId)}
    >
      <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
      <Text style={styles.swipeActionLabel}>Read</Text>
    </TouchableOpacity>
  );

  const handleNotificationPress = async (item: Notification) => {
    if (!item.read) {
      await handleMarkRead(item.id);
    }

    if (item.channelId) {
      if (item.guildId) {
        navigation.navigate('ChannelChat', {
          channelId: item.channelId,
          channelName: 'Channel',
          guildId: item.guildId,
        });
        return;
      }
      navigation.navigate('DirectMessage', {
        channelId: item.channelId,
        recipientName: item.senderName || 'User',
        recipientId: item.senderId || undefined,
      });
      return;
    }

    if (item.type === 'friend_request' || item.type === 'friend_accept') {
      navigation.navigate('Friends');
      return;
    }

    if (item.guildId) {
      navigation.navigate('GuildChannels', {
        guildId: item.guildId,
        guildName: 'Portal',
      });
    }
  };

  const renderItem = ({ item, index }: { item: Notification; index: number }) => {
    // For neo theme, cycle through palette colors for each card's background
    const neoCardStyle = neo
      ? {
          backgroundColor:
            neo.palette[NEO_PALETTE_KEYS[index % NEO_PALETTE_KEYS.length]],
        }
      : undefined;

    return (
      <Swipeable
        ref={(ref) => {
          if (ref) {
            swipeableRefs.current.set(item.id, ref);
          } else {
            swipeableRefs.current.delete(item.id);
          }
        }}
        renderRightActions={renderRightActions(item.id)}
        renderLeftActions={!item.read ? renderLeftActions(item.id) : undefined}
        onSwipeableWillOpen={() => onSwipeableWillOpen(item.id)}
        onSwipeableOpen={(direction) => {
          if (direction === 'right') {
            handleDismiss(item.id);
          } else if (direction === 'left' && !item.read) {
            handleSwipeMarkRead(item.id);
          }
        }}
        overshootRight={false}
        overshootLeft={false}
        friction={2}
        rightThreshold={80}
        leftThreshold={80}
      >
        <TouchableOpacity
          style={[
            styles.notifItem,
            neoCardStyle,
            !item.read && styles.notifItemUnread,
          ]}
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.6}
        >
          <View
            style={[
              styles.iconContainer,
              !item.read && styles.iconContainerUnread,
            ]}
          >
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
              <Text style={styles.notifTime}>
                {formatRelativeTime(item.createdAt)}
              </Text>
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
      </Swipeable>
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <PatternBackground>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.bulkActions}>
        <TouchableOpacity
          style={[styles.bulkButton, readNotifications.length === 0 && styles.bulkButtonDisabled]}
          onPress={handleClearRead}
          disabled={readNotifications.length === 0}
        >
          <Text style={styles.bulkButtonText}>Clear Read</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bulkButton, notifications.length === 0 && styles.bulkButtonDisabled]}
          onPress={handleClearAll}
          disabled={notifications.length === 0}
        >
          <Text style={styles.bulkButtonText}>Clear All</Text>
        </TouchableOpacity>
      </View>
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
    </PatternBackground>
  );
}
