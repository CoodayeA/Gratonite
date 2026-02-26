import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PortalsStackParamList } from '../../navigation/types';
import { guildsApi } from '../../lib/api';
import { colors, spacing, radius, fontSize } from '../../theme';

type Props = NativeStackScreenProps<PortalsStackParamList, 'GuildMembers'>;

interface Member {
  userId: string;
  nickname?: string | null;
  roleIds?: string[];
  user?: { id?: string; username?: string; displayName?: string };
}

export function GuildMembersScreen({ route }: Props) {
  const { guildId } = route.params;

  const [members, setMembers] = useState<Member[]>([]);
  const [bans, setBans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'members' | 'bans'>('members');
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const load = useCallback(async () => {
    try {
      const [m, b] = await Promise.all([
        guildsApi.getMembers(guildId, 200),
        guildsApi.getBans(guildId),
      ]);
      setMembers(m);
      setBans(b);
      setError('');
    } catch {
      setError('Failed to load members.');
    }
  }, [guildId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(''), 2200);
    return () => clearTimeout(timer);
  }, [feedback]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const name = m.user?.displayName ?? m.user?.username ?? m.nickname ?? m.userId;
      return String(name).toLowerCase().includes(q) || m.userId.includes(q);
    });
  }, [members, search]);

  const filteredBans = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bans;
    return bans.filter((b: any) => {
      return (
        String(b.userId ?? '').includes(q) ||
        String(b.reason ?? '').toLowerCase().includes(q)
      );
    });
  }, [bans, search]);

  async function handleKick(userId: string) {
    Alert.alert('Kick Member', 'Kick this member? They can rejoin with an invite.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Kick',
        style: 'destructive',
        onPress: async () => {
          setActionUserId(userId);
          try {
            await guildsApi.kickMember(guildId, userId);
            await load();
            setFeedback('Member kicked.');
          } catch {
            Alert.alert('Error', 'Failed to kick member.');
          } finally {
            setActionUserId(null);
          }
        },
      },
    ]);
  }

  async function handleBan(userId: string) {
    Alert.alert('Ban Member', 'Ban this member? They will be blocked from rejoining.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Ban',
        style: 'destructive',
        onPress: async () => {
          setActionUserId(userId);
          try {
            await guildsApi.banMember(guildId, userId);
            await load();
            setFeedback('Member banned.');
          } catch {
            Alert.alert('Error', 'Failed to ban member.');
          } finally {
            setActionUserId(null);
          }
        },
      },
    ]);
  }

  async function handleUnban(userId: string) {
    Alert.alert('Unban User', 'Allow this user to rejoin?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unban',
        onPress: async () => {
          setActionUserId(userId);
          try {
            await guildsApi.unbanMember(guildId, userId);
            await load();
            setFeedback('User unbanned.');
          } catch {
            Alert.alert('Error', 'Failed to unban user.');
          } finally {
            setActionUserId(null);
          }
        },
      },
    ]);
  }

  const renderMember = useCallback(({ item }: { item: Member }) => {
    const name = item.user?.displayName ?? item.user?.username ?? item.nickname ?? item.userId;
    const busy = actionUserId === item.userId;
    return (
      <View style={styles.memberCard}>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{name}</Text>
          <Text style={styles.memberSubline}>
            ID: {item.userId}
            {item.nickname ? ` | ${item.nickname}` : ''}
            {item.roleIds ? ` | ${item.roleIds.length} roles` : ''}
          </Text>
        </View>
        <View style={styles.memberActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleKick(item.userId)}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.text.secondary} size="small" />
            ) : (
              <Text style={styles.actionText}>Kick</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionDanger]}
            onPress={() => handleBan(item.userId)}
            disabled={busy}
          >
            <Text style={styles.actionDangerText}>Ban</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [actionUserId, guildId]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderBan = useCallback(({ item }: { item: any }) => {
    const busy = actionUserId === item.userId;
    return (
      <View style={styles.memberCard}>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.userId}</Text>
          <Text style={styles.memberSubline}>
            {item.reason ? `Reason: ${item.reason}` : 'No reason provided'}
            {item.createdAt ? ` | ${new Date(item.createdAt).toLocaleDateString()}` : ''}
          </Text>
        </View>
        <View style={styles.memberActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleUnban(item.userId)}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.text.secondary} size="small" />
            ) : (
              <Text style={styles.actionText}>Unban</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [actionUserId, guildId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <ActivityIndicator color={colors.brand.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Tab bar */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'members' && styles.tabActive]}
          onPress={() => setActiveTab('members')}
        >
          <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
            Members ({members.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bans' && styles.tabActive]}
          onPress={() => setActiveTab('bans')}
        >
          <Text style={[styles.tabText, activeTab === 'bans' && styles.tabTextActive]}>
            Banned ({bans.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <TextInput
        style={[styles.input, { marginHorizontal: spacing.lg, marginBottom: spacing.sm }]}
        value={search}
        onChangeText={setSearch}
        placeholder={activeTab === 'members' ? 'Search members...' : 'Search bans...'}
        placeholderTextColor={colors.text.muted}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}

      {activeTab === 'members' ? (
        <FlatList
          data={filteredMembers}
          keyExtractor={(item) => item.userId}
          renderItem={renderMember}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No members found.</Text>
          }
        />
      ) : (
        <FlatList
          data={filteredBans}
          keyExtractor={(item: any) => `ban-${item.userId}`}
          renderItem={renderBan}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No bans in this portal.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg.primary,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  tabActive: {
    backgroundColor: colors.brand.primary,
  },
  tabText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.text.inverse,
  },
  input: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text.primary,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  memberCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  memberInfo: {
    marginBottom: spacing.sm,
  },
  memberName: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  memberSubline: {
    color: colors.text.muted,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  memberActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 60,
    alignItems: 'center',
  },
  actionText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  actionDanger: {
    backgroundColor: 'rgba(232, 90, 110, 0.15)',
  },
  actionDangerText: {
    color: colors.accent.error,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  errorText: {
    color: colors.accent.error,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  feedbackText: {
    color: colors.accent.success,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
