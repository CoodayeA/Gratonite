import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { relationships as relApi, users as usersApi } from '../../lib/api';
import { colors, spacing, fontSize, borderRadius } from '../../lib/theme';
import type { Relationship, User } from '../../types';
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
  const [rels, setRels] = useState<Relationship[]>([]);
  const [userMap, setUserMap] = useState<Record<string, User>>({});
  const [tab, setTab] = useState<Tab>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRelationships = useCallback(async () => {
    try {
      const data = await relApi.getAll();
      setRels(data);

      // Fetch user info for all relationship targets
      const targetIds = data.map((r) => r.targetId).filter(Boolean);
      if (targetIds.length > 0) {
        const users = await usersApi.getBatch(targetIds);
        const map: Record<string, any> = {};
        users.forEach((u) => { map[u.id] = u; });
        setUserMap(map);
      }
    } catch (err: any) {
      if (err.status !== 401) {
        Alert.alert('Error', 'Failed to load friends');
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
      Alert.alert('Error', err.message);
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
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const handleOpenDM = async (userId: string) => {
    try {
      const dm = await relApi.openDM(userId);
      navigation.navigate('DirectMessage', { channelId: dm.id, recipientName: userMap[userId]?.username || 'User' });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const renderItem = ({ item }: { item: Relationship }) => {
    const user = userMap[item.targetId];
    const name = user?.displayName || user?.username || item.targetId.slice(0, 8);

    return (
      <View style={styles.friendItem}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{name}</Text>
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
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenDM(item.targetId)}>
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
      </View>

      {/* Tabs */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.bgSecondary,
  },
  tabActive: {
    backgroundColor: colors.accentPrimary,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
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
});
