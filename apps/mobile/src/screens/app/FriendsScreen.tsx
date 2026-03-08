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
import { relationships as relApi, friendshipStreaks as streaksApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import Avatar from '../../components/Avatar';
import FriendshipStreakBadge from '../../components/FriendshipStreakBadge';
import { presenceStore } from '../../lib/presenceStore';
import type { Relationship } from '../../types';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppTabParamList, AppStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Friends'>,
  NativeStackScreenProps<AppStackParamList>
>;

type Tab = 'all' | 'pending' | 'blocked';

export default function FriendsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [rels, setRels] = useState<Relationship[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [streaks, setStreaks] = useState<Map<string, number>>(new Map());

  const fetchRelationships = useCallback(async () => {
    try {
      const data = await relApi.getAll();
      setRels(data);

      // Feed statuses into presence store
      data.forEach((r) => {
        if (r.user?.id && r.user.status) {
          presenceStore.set(r.user.id, r.user.status as any);
        }
      });

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
        toast.error('Failed to load friends');
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

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
      paddingBottom: spacing.sm,
      ...(neo ? { borderBottomWidth: neo.borderWidth, borderBottomColor: colors.border } : {}),
    },
    headerTitle: {
      fontSize: fontSize.xl,
      fontWeight: neo ? '800' : '700',
      color: colors.textPrimary,
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
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
      backgroundColor: colors.bgSecondary,
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    tabActive: {
      backgroundColor: colors.accentPrimary,
    },
    tabText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: neo ? '700' : '500',
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
    },
    tabTextActive: {
      color: colors.white,
    },
    list: {
      paddingTop: spacing.sm,
    },
    friendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    friendInfo: {
      flex: 1,
      marginLeft: spacing.md,
    },
    friendName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
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
      padding: spacing.sm,
    },
    acceptBtn: {
      padding: spacing.sm,
    },
    empty: {
      alignItems: 'center',
      paddingTop: 80,
      gap: spacing.md,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.md,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderItem = ({ item }: { item: Relationship }) => {
    const user = item.user;
    const name = user?.displayName || user?.username || item.targetId.slice(0, 8);

    return (
      <View style={styles.friendItem}>
        <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: item.targetId })}>
          <Avatar
            userId={item.targetId}
            avatarHash={user?.avatarHash}
            name={name}
            size={40}
            showStatus
          />
        </TouchableOpacity>
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
            <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item.targetId)}>
              <Ionicons name="checkmark" size={20} color={colors.success} />
            </TouchableOpacity>
          )}
          {item.type === 'friend' && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenDM(item.targetId, user?.username || 'User')}>
              <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          {(item.type === 'friend' || item.type === 'pending_incoming' || item.type === 'pending_outgoing') && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleRemove(item.targetId)}>
              <Ionicons name="close" size={20} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <TouchableOpacity onPress={() => navigation.navigate('MessageRequests')}>
            <Ionicons name="mail-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('FriendAdd')}>
            <Ionicons name="person-add-outline" size={24} color={colors.accentPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['all', 'pending', 'blocked'] as Tab[]).map((t) => (
          <TouchableOpacity
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
          </TouchableOpacity>
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
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {tab === 'all' ? 'No friends yet' : tab === 'pending' ? 'No pending requests' : 'No blocked users'}
            </Text>
          </View>
        }
      />
    </View>
  );
}
