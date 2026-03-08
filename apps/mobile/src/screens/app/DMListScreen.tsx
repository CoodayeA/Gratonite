import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppState } from '../../contexts/AppStateContext';
import Avatar from '../../components/Avatar';
import { useChannelUnread } from '../../lib/unreadStore';
import { formatRelativeTime } from '../../lib/formatters';
import { useTheme } from '../../lib/theme';
import type { DMChannel } from '../../types';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppTabParamList, AppStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'DMs'>,
  NativeStackScreenProps<AppStackParamList>
>;

function DMItem({ item, onPress, styles, colors }: { item: DMChannel; onPress: () => void; styles: any; colors: any }) {
  const name = item.recipient?.displayName || item.recipient?.username || 'Unknown';
  const unread = useChannelUnread(item.id);

  return (
    <TouchableOpacity style={styles.dmItem} onPress={onPress}>
      <Avatar
        userId={item.recipientId}
        avatarHash={item.recipient?.avatarHash}
        name={name}
        size={44}
        showStatus
      />
      <View style={styles.dmInfo}>
        <Text style={[styles.dmName, unread.count > 0 && styles.dmNameUnread]} numberOfLines={1}>
          {name}
        </Text>
        {item.lastMessageAt && (
          <Text style={styles.dmMeta} numberOfLines={1}>
            {formatRelativeTime(item.lastMessageAt)}
          </Text>
        )}
      </View>
      {unread.count > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{unread.count > 99 ? '99+' : unread.count}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function DMListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { dmChannels, refreshDMs } = useAppState();
  const [refreshing, setRefreshing] = useState(false);
  const { colors, spacing, fontSize, borderRadius } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
    },
    headerTitle: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    headerBtn: {
      padding: spacing.xs,
    },
    list: {
      paddingTop: spacing.sm,
    },
    dmItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    dmInfo: {
      flex: 1,
    },
    dmName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    dmNameUnread: {
      fontWeight: '700',
    },
    dmMeta: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
    unreadBadge: {
      backgroundColor: colors.error,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 6,
    },
    unreadText: {
      color: colors.white,
      fontSize: 11,
      fontWeight: '700',
    },
    empty: {
      alignItems: 'center',
      paddingTop: 80,
      gap: spacing.md,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: fontSize.lg,
      fontWeight: '600',
    },
    emptySubtext: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
  }), [colors, spacing, fontSize, borderRadius]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshDMs();
    setRefreshing(false);
  }, [refreshDMs]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('DMSearch')} style={styles.headerBtn}>
            <Ionicons name="search-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('GroupDMCreate')} style={styles.headerBtn}>
            <Ionicons name="people-circle-outline" size={26} color={colors.accentPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={dmChannels}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DMItem
            item={item}
            styles={styles}
            colors={colors}
            onPress={() => navigation.navigate('DirectMessage', {
              channelId: item.id,
              recipientName: item.recipient?.displayName || item.recipient?.username || 'Unknown',
              recipientId: item.recipientId,
            })}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>Start a conversation from the Friends tab</Text>
          </View>
        }
      />
    </View>
  );
}
