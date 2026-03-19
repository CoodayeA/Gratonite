import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { relationships as relApi, friendshipStreaks as streaksApi, users as usersApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme, useGlass } from '../../lib/theme';
import Avatar from '../../components/Avatar';
import FriendshipStreakBadge from '../../components/FriendshipStreakBadge';
import PressableScale from '../../components/PressableScale';
import AnimatedListItem from '../../components/AnimatedListItem';
import { presenceStore } from '../../lib/presenceStore';
import type { Relationship } from '../../types';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppTabParamList, AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';
import LoadErrorCard from '../../components/LoadErrorCard';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Friends'>,
  NativeStackScreenProps<AppStackParamList>
>;

type Tab = 'all' | 'pending' | 'blocked';

const NEO_PALETTE_KEYS = ['coral', 'mint', 'butter', 'lavender', 'sky', 'peach'] as const;

export default function FriendsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const glass = useGlass();
  const toast = useToast();
  const [rels, setRels] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [streaks, setStreaks] = useState<Map<string, number>>(new Map());
  const isFetchingRef = useRef(false);
  const refreshingRef = useRef(false);
  refreshingRef.current = refreshing;
  const relsLenRef = useRef(0);
  relsLenRef.current = rels.length;

  const fetchRelationships = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setLoadError(null);
      const data = await relApi.getAll();
      setRels(data);

      // Fetch real presence statuses for friends
      const friendIds = data
        .filter((r) => r.type === 'friend' && r.user?.id)
        .map((r) => r.user!.id);
      if (friendIds.length > 0) {
        try {
          presenceStore.setBulk(friendIds.map((userId) => ({ userId, status: 'offline' })));
          for (let i = 0; i < friendIds.length; i += 200) {
            const batch = friendIds.slice(i, i + 200);
            const presences = await usersApi.getPresences(batch);
            presenceStore.setBulk(
              presences.map((p) => ({ userId: p.userId, status: p.status as any })),
            );
          }
        } catch {
          // Presence is best-effort
        }
      }

      // Fetch friendship streaks
      try {
        const streakData = await streaksApi.getAll();
        const map = new Map<string, number>();
        streakData.forEach((s) => map.set(s.friendId, s.streak));
        setStreaks(map);
      } catch {
        // Non-critical, ignore
      }
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load friends';
        if (refreshingRef.current || relsLenRef.current > 0) { toast.error(message); } else { setLoadError(message); }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [toast]);

  useEffect(() => {
    fetchRelationships();
  }, [fetchRelationships]);

  const filtered = rels.filter((r) => {
    if (tab === 'all') return r.type === 'friend';
    if (tab === 'pending') return r.type === 'pending_incoming' || r.type === 'pending_outgoing';
    if (tab === 'blocked') return r.type === 'blocked';
    return false;
  });

  const handleAccept = async (userId: string) => {
    try {
      await relApi.acceptFriend(userId);
      fetchRelationships();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemove = async (userId: string) => {
    Alert.alert('Remove Friend', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await relApi.removeFriend(userId);
            fetchRelationships();
          } catch (err: any) {
            toast.error(err.message);
          }
        },
      },
    ]);
  };

  const handleOpenDM = async (userId: string, username: string) => {
    try {
      const dm = await relApi.openDM(userId);
      navigation.navigate('DirectMessage', { channelId: dm.id, recipientName: username, recipientId: userId });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

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
      ...(neo ? { borderBottomWidth: neo.borderWidth, borderBottomColor: colors.border } : {}),
    },
    headerTitleWrap: {
      flexDirection: 'column',
    },
    headerTitle: {
      fontSize: fontSize.xl,
      color: colors.textPrimary,
      ...(neo
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
        : (neo ? colors.bgElevated : `${colors.accentPrimary}18`),
      justifyContent: 'center',
      alignItems: 'center',
      ...(neo ? {
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
      } : {}),
      ...(glass ? {
        borderWidth: 1,
        borderColor: glass.glassBorder,
      } : {}),
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    tab: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: glass
        ? glass.glassBackground
        : colors.bgSecondary,
      ...(neo ? {
        borderWidth: 2,
        borderColor: colors.border,
        borderRadius: 0,
      } : {}),
      ...(glass ? {
        borderWidth: 1,
        borderColor: glass.glassBorder,
        borderRadius: borderRadius.full,
      } : {}),
    },
    tabActive: {
      ...(neo ? {
        backgroundColor: neo.palette.coral,
      } : {
        backgroundColor: colors.accentPrimary,
      }),
      shadowColor: colors.accentPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    tabText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: neo ? '700' : '500',
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
    },
    tabTextActive: {
      color: neo ? '#000000' : colors.white,
      fontWeight: '800',
    },
    list: {
      paddingTop: spacing.sm,
      paddingBottom: insets.bottom,
      ...(glass || neo ? {} : { paddingHorizontal: spacing.sm }),
    },
    friendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      ...(neo ? {
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
    friendInfo: {
      flex: 1,
      marginLeft: spacing.md,
    },
    friendName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    friendMeta: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    actionBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `${colors.error}18`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    acceptBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `${colors.success}20`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chatBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `${colors.accentPrimary}18`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    empty: {
      alignItems: 'center',
      paddingTop: 80,
      gap: spacing.md,
    },
    emptyIcon: {
      transform: [{ rotate: '-12deg' }],
    },
    emptyTitle: {
      color: colors.textSecondary,
      fontSize: fontSize.lg,
      fontWeight: '700',
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
  }), [colors, spacing, fontSize, borderRadius, neo, glass, insets.bottom]);

  const renderItem = ({ item, index }: { item: Relationship; index: number }) => {
    const user = item.user;
    const name = user?.displayName || user?.username || item.targetId.slice(0, 8);

    const neoItemStyle = neo !== null
      ? { backgroundColor: neo.palette[NEO_PALETTE_KEYS[index % 6]] }
      : undefined;

    return (
      <AnimatedListItem index={index}>
      <View style={[styles.friendItem, neoItemStyle]}>
        <PressableScale onPress={() => navigation.navigate('UserProfile', { userId: item.targetId })}>
          <Avatar
            userId={item.targetId}
            avatarHash={user?.avatarHash}
            name={name}
            size={44}
            showStatus
          />
        </PressableScale>
        <View style={styles.friendInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.friendName}>{name}</Text>
            <FriendshipStreakBadge streak={streaks.get(item.targetId) ?? 0} />
          </View>
          {item.type === 'pending_incoming' && (
            <Text style={styles.friendMeta}>Incoming request</Text>
          )}
          {item.type === 'pending_outgoing' && (
            <Text style={styles.friendMeta}>Request sent</Text>
          )}
        </View>
        <View style={styles.actions}>
          {item.type === 'pending_incoming' && (
            <PressableScale style={styles.acceptBtn} scaleTo={0.9} onPress={() => handleAccept(item.targetId)} accessibilityLabel="Accept friend request">
              <Ionicons name="checkmark" size={20} color={colors.success} />
            </PressableScale>
          )}
          {item.type === 'friend' && (
            <PressableScale style={styles.chatBtn} scaleTo={0.9} onPress={() => handleOpenDM(item.targetId, user?.username || 'User')} accessibilityLabel="Send message">
              <Ionicons name="chatbubble-outline" size={18} color={colors.accentPrimary} />
            </PressableScale>
          )}
          {(item.type === 'friend' || item.type === 'pending_incoming' || item.type === 'pending_outgoing') && (
            <PressableScale style={styles.actionBtn} scaleTo={0.9} onPress={() => handleRemove(item.targetId)} accessibilityLabel="Remove friend">
              <Ionicons name="close" size={18} color={colors.error} />
            </PressableScale>
          )}
        </View>
      </View>
      </AnimatedListItem>
    );
  };

  if (loadError && rels.length === 0) return <LoadErrorCard title="Failed to load friends" message={loadError} onRetry={() => { setLoading(true); fetchRelationships(); }} />;

  return (
    <PatternBackground>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Friends</Text>
          {glass && !neo && <View style={styles.headerAccentBar} />}
        </View>
        <View style={styles.headerActions}>
          <PressableScale style={styles.headerBtn} onPress={() => navigation.navigate('MessageRequests')} accessibilityLabel="Message requests">
            <Ionicons name="mail-outline" size={22} color={colors.textPrimary} />
          </PressableScale>
          <PressableScale style={styles.headerBtn} onPress={() => navigation.navigate('FriendAdd')} accessibilityLabel="Add friend">
            <Ionicons name="person-add-outline" size={22} color={colors.accentPrimary} />
          </PressableScale>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['all', 'pending', 'blocked'] as Tab[]).map((t) => (
          <PressableScale
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'pending' && rels.filter((r) => r.type === 'pending_incoming').length > 0 && (
                ` (${rels.filter((r) => r.type === 'pending_incoming').length})`
              )}
            </Text>
          </PressableScale>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id || item.targetId}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRelationships(); }} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={64} color={colors.accentPrimary} />
            </View>
            <Text style={styles.emptyTitle}>
              {tab === 'all' ? 'No friends yet' : tab === 'pending' ? 'No pending requests' : 'No blocked users'}
            </Text>
            <Text style={styles.emptyText}>
              {tab === 'all' ? 'Tap the + to add someone!' : tab === 'pending' ? 'All caught up' : 'Your block list is empty'}
            </Text>
          </View>
        }
      />
    </View>
    </PatternBackground>
  );
}
