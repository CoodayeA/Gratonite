import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppState } from '../../contexts/AppStateContext';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import Avatar from '../../components/Avatar';
import PressableScale from '../../components/PressableScale';
import AnimatedListItem from '../../components/AnimatedListItem';
import { useChannelUnread } from '../../lib/unreadStore';
import { formatRelativeTime } from '../../lib/formatters';
import { useTheme, useNeo, useGlass } from '../../lib/theme';
import type { DMChannel } from '../../types';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppTabParamList, AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'DMs'>,
  NativeStackScreenProps<AppStackParamList>
>;

const NEO_PALETTE_KEYS = ['coral', 'mint', 'butter', 'lavender', 'sky', 'peach'] as const;

function DMItem({ item, index, onPress, styles, colors, neo, glass }: { item: DMChannel; index: number; onPress: () => void; styles: any; colors: any; neo: any; glass: any }) {
  const name = item.recipient?.displayName || item.recipient?.username || 'Unknown';
  const unread = useChannelUnread(item.id);

  const neoItemStyle = neo !== null
    ? { backgroundColor: neo.palette[NEO_PALETTE_KEYS[index % 6]] }
    : undefined;

  const badgeScale = useSharedValue(1);
  useEffect(() => {
    if (unread.count > 0) {
      badgeScale.value = withRepeat(withTiming(1.15, { duration: 600 }), -1, true);
    }
  }, [unread.count]);
  const badgeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  return (
    <AnimatedListItem index={index}>
    <PressableScale style={[styles.dmItem, neoItemStyle]} onPress={onPress}>
      <Avatar
        userId={item.recipientId}
        avatarHash={item.recipient?.avatarHash}
        name={name}
        size={48}
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
        <Animated.View style={[styles.unreadBadge, badgeAnimStyle, neo ? { borderWidth: 2, borderColor: '#000' } : {}]}>
          <Text style={styles.unreadText}>{unread.count > 99 ? '99+' : unread.count}</Text>
        </Animated.View>
      )}
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </PressableScale>
    </AnimatedListItem>
  );
}

export default function DMListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { dmChannels, refreshDMs } = useAppState();
  const [refreshing, setRefreshing] = useState(false);
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const neo = useNeo();
  const glass = useGlass();

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
    headerTitleWrap: {
      flexDirection: 'column',
    },
    headerTitle: {
      fontSize: fontSize.xl,
      color: colors.textPrimary,
      ...(neo !== null
        ? { fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }
        : { fontWeight: '700' }
      ),
    },
    headerAccentBar: {
      height: 3,
      backgroundColor: colors.accentPrimary,
      borderRadius: 2,
      marginTop: 4,
      width: '100%',
    },
    headerActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: glass
        ? glass.glassBackground
        : (neo !== null ? colors.bgElevated : `${colors.accentPrimary}18`),
      justifyContent: 'center',
      alignItems: 'center',
      ...(neo !== null ? {
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
      } : {}),
      ...(glass ? {
        borderWidth: 1,
        borderColor: glass.glassBorder,
      } : {}),
    },
    list: {
      paddingTop: spacing.sm,
      ...(glass || neo !== null ? {} : { paddingHorizontal: spacing.sm }),
    },
    dmItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      ...(neo !== null ? {
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
        borderRadius: 0,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
      } : {}),
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: glass.glassBorder,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
      } : {}),
      ...(neo === null && !glass ? {
        backgroundColor: colors.bgElevated,
        borderRadius: borderRadius.md,
        marginHorizontal: spacing.sm,
        marginBottom: spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
      } : {}),
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
      fontWeight: '800',
    },
    dmMeta: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
      textAlign: 'right',
      position: 'absolute',
      right: 0,
      top: 0,
    },
    dmMetaWrap: {
      flex: 1,
    },
    unreadBadge: {
      backgroundColor: colors.error,
      borderRadius: 12,
      minWidth: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 8,
      shadowColor: colors.error,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 4,
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
    emptyIcon: {
      transform: [{ rotate: '-12deg' }],
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: fontSize.lg,
      fontWeight: '700',
    },
    emptySubtext: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
  }), [colors, spacing, fontSize, borderRadius, neo, glass]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshDMs();
    setRefreshing(false);
  }, [refreshDMs]);

  return (
    <PatternBackground>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Messages</Text>
          {glass && !neo && <View style={styles.headerAccentBar} />}
        </View>
        <View style={styles.headerActions}>
          <PressableScale onPress={() => navigation.navigate('DMSearch')} style={styles.headerBtn} accessibilityLabel="Search conversations">
            <Ionicons name="search-outline" size={24} color={colors.textPrimary} />
          </PressableScale>
          <PressableScale onPress={() => navigation.navigate('GroupDMCreate')} style={styles.headerBtn} accessibilityLabel="Create group chat">
            <Ionicons name="people-circle-outline" size={26} color={colors.accentPrimary} />
          </PressableScale>
        </View>
      </View>

      <FlatList
        data={dmChannels}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <DMItem
            item={item}
            index={index}
            styles={styles}
            colors={colors}
            neo={neo}
            glass={glass}
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
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={64} color={colors.accentPrimary} />
            </View>
            <Text style={styles.emptyText}>Start chatting!</Text>
            <Text style={styles.emptySubtext}>Start a conversation from the Friends tab</Text>
          </View>
        }
      />
    </View>
    </PatternBackground>
  );
}
