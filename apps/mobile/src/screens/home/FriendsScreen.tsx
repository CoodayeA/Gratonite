import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Swipeable } from 'react-native-gesture-handler';
import type { HomeStackParamList } from '../../navigation/types';
import { relationshipsApi, usersApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import type { PresenceStatusType } from '../../components/ui/PresenceDot';
import { colors, spacing, radius, fontSize } from '../../theme';

// ── Types ──────────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Friends'>;

type FilterTab = 'all' | 'online' | 'pending' | 'blocked';

interface Relationship {
  userId: string;
  targetId: string;
  type: 'friend' | 'blocked' | 'pending_incoming' | 'pending_outgoing';
  createdAt: string;
}

interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
}

interface DmChannel {
  id: string;
  type: 'dm' | 'group_dm';
  name: string | null;
  lastMessageId: string | null;
  otherUserId?: string | null;
  recipientIds?: string[];
  lastMessageContent?: string | null;
  lastMessageAt?: string | null;
}

type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';

interface PresenceEntry {
  userId: string;
  status: string;
  lastSeen: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const PRESENCE_COLORS: Record<string, string> = {
  online: colors.status.online,
  idle: colors.status.idle,
  dnd: colors.status.dnd,
  offline: colors.status.offline,
};

function getPresenceColor(status?: string): string {
  return PRESENCE_COLORS[status ?? 'offline'] ?? colors.status.offline;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

// ── Main Screen ────────────────────────────────────────────────────────────

export function FriendsScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);

  // ── Data Fetching ──────────────────────────────────────────────────────

  const {
    data: relationships = [],
    isLoading: relLoading,
    refetch: refetchRels,
  } = useQuery<Relationship[]>({
    queryKey: ['relationships'],
    queryFn: () => relationshipsApi.getAll(),
  });

  const {
    data: dmChannels = [],
    isLoading: dmLoading,
    refetch: refetchDms,
  } = useQuery<DmChannel[]>({
    queryKey: ['dm-channels'],
    queryFn: () => relationshipsApi.getDmChannels(),
  });

  // Collect all user IDs we need summaries for
  const allUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rel of relationships) {
      ids.add(rel.targetId);
      if (rel.userId !== currentUser?.id) ids.add(rel.userId);
    }
    for (const dm of dmChannels) {
      if (dm.otherUserId) ids.add(dm.otherUserId);
      dm.recipientIds?.forEach((id) => ids.add(id));
    }
    // Remove self
    if (currentUser?.id) ids.delete(currentUser.id);
    return Array.from(ids);
  }, [relationships, dmChannels, currentUser?.id]);

  const { data: userSummaries = [] } = useQuery<UserSummary[]>({
    queryKey: ['users', 'summaries', allUserIds],
    queryFn: () => usersApi.getSummaries(allUserIds),
    enabled: allUserIds.length > 0,
  });

  const usersById = useMemo(() => {
    const map = new Map<string, UserSummary>();
    for (const u of userSummaries) {
      map.set(u.id, u);
    }
    return map;
  }, [userSummaries]);

  // Presence for friends
  const friendUserIds = useMemo(() => {
    return relationships
      .filter((r) => r.type === 'friend')
      .map((r) => r.targetId);
  }, [relationships]);

  const { data: presences = [] } = useQuery<PresenceEntry[]>({
    queryKey: ['users', 'presences', friendUserIds],
    queryFn: () => usersApi.getPresences(friendUserIds),
    enabled: friendUserIds.length > 0,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const presenceById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of presences) {
      map.set(p.userId, p.status);
    }
    return map;
  }, [presences]);

  // ── Mutations ──────────────────────────────────────────────────────────

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['relationships'] });
    queryClient.invalidateQueries({ queryKey: ['dm-channels'] });
  }, [queryClient]);

  const acceptMutation = useMutation({
    mutationFn: (userId: string) => relationshipsApi.acceptFriendRequest(userId),
    onSuccess: invalidateAll,
  });

  const declineMutation = useMutation({
    mutationFn: (userId: string) => relationshipsApi.removeFriend(userId),
    onSuccess: invalidateAll,
  });

  const removeFriendMutation = useMutation({
    mutationFn: (userId: string) => relationshipsApi.removeFriend(userId),
    onSuccess: invalidateAll,
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => relationshipsApi.unblock(userId),
    onSuccess: invalidateAll,
  });

  // ── Filtered data ──────────────────────────────────────────────────────

  const onlineCount = useMemo(() => {
    return relationships.filter((r) => {
      if (r.type !== 'friend') return false;
      const status = presenceById.get(r.targetId) ?? 'offline';
      return status === 'online' || status === 'idle' || status === 'dnd';
    }).length;
  }, [relationships, presenceById]);

  const filteredRelationships = useMemo(() => {
    switch (filter) {
      case 'all':
        return relationships.filter((r) => r.type === 'friend');
      case 'online':
        return relationships.filter((r) => {
          if (r.type !== 'friend') return false;
          const status = presenceById.get(r.targetId) ?? 'offline';
          return status === 'online' || status === 'idle' || status === 'dnd';
        });
      case 'pending':
        return relationships.filter(
          (r) => r.type === 'pending_incoming' || r.type === 'pending_outgoing',
        );
      case 'blocked':
        return relationships.filter((r) => r.type === 'blocked');
      default:
        return [];
    }
  }, [relationships, filter, presenceById]);

  const pendingCount = useMemo(() => {
    return relationships.filter(
      (r) => r.type === 'pending_incoming' || r.type === 'pending_outgoing',
    ).length;
  }, [relationships]);

  // ── Navigation Handlers ────────────────────────────────────────────────

  const handleOpenDm = useCallback(
    async (userId: string) => {
      try {
        const channel = await relationshipsApi.openDm(userId);
        if (channel?.id) {
          navigation.navigate('DmChat', { channelId: channel.id });
        }
      } catch {
        Alert.alert('Error', 'Could not open DM channel.');
      }
    },
    [navigation],
  );

  const handleDmTap = useCallback(
    (channelId: string) => {
      navigation.navigate('DmChat', { channelId });
    },
    [navigation],
  );

  const handleRemoveFriend = useCallback(
    (userId: string, name: string) => {
      Alert.alert('Remove Friend', `Remove ${name} from your friends?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFriendMutation.mutate(userId),
        },
      ]);
    },
    [removeFriendMutation],
  );

  // ── Pull to Refresh ────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchRels(), refetchDms()]);
    setRefreshing(false);
  }, [refetchRels, refetchDms]);

  // ── Filter Pills ───────────────────────────────────────────────────────

  const filters: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'online', label: 'Online', count: onlineCount > 0 ? onlineCount : undefined },
    { key: 'pending', label: 'Pending', count: pendingCount > 0 ? pendingCount : undefined },
    { key: 'blocked', label: 'Blocked' },
  ];

  const emptyMessages: Record<FilterTab, string> = {
    all: "No friends yet. Send a friend request to get started!",
    online: 'No friends online right now.',
    pending: 'No pending friend requests.',
    blocked: 'No blocked users.',
  };

  // ── Swipe Actions ──────────────────────────────────────────────────────

  const renderRightActions = useCallback(
    (userId: string, name: string) => {
      return (
        <View style={styles.swipeActions}>
          <TouchableOpacity
            style={styles.swipeActionMessage}
            onPress={() => handleOpenDm(userId)}
            activeOpacity={0.7}
          >
            <Text style={styles.swipeActionText}>{'\u2709'}</Text>
            <Text style={styles.swipeActionLabel}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.swipeActionRemove}
            onPress={() => handleRemoveFriend(userId, name)}
            activeOpacity={0.7}
          >
            <Text style={styles.swipeActionText}>{'\u2715'}</Text>
            <Text style={styles.swipeActionLabel}>Remove</Text>
          </TouchableOpacity>
        </View>
      );
    },
    [handleOpenDm, handleRemoveFriend],
  );

  // ── Render DM Item ─────────────────────────────────────────────────────

  const renderDmItem = useCallback(
    (dm: DmChannel) => {
      const otherUserId = dm.otherUserId ?? dm.recipientIds?.[0];
      const user = otherUserId ? usersById.get(otherUserId) : undefined;
      const displayName = user?.displayName ?? dm.name ?? 'Unknown';
      const presenceStatus = otherUserId ? presenceById.get(otherUserId) ?? 'offline' : 'offline';
      const lastMessage = dm.lastMessageContent
        ? dm.lastMessageContent.length > 40
          ? dm.lastMessageContent.slice(0, 40) + '...'
          : dm.lastMessageContent
        : 'No messages yet';

      return (
        <TouchableOpacity
          key={dm.id}
          style={styles.dmItem}
          onPress={() => handleDmTap(dm.id)}
          activeOpacity={0.7}
        >
          <Avatar
            size={48}
            userId={otherUserId}
            avatarHash={user?.avatarHash ?? undefined}
            displayName={displayName}
            username={user?.username}
            showPresence
            presenceStatus={presenceStatus as PresenceStatusType}
          />
          <View style={styles.dmItemContent}>
            <View style={styles.dmItemHeader}>
              <Text style={styles.dmItemName} numberOfLines={1}>
                {displayName}
              </Text>
              {dm.lastMessageAt && (
                <Text style={styles.dmItemTime}>{timeAgo(dm.lastMessageAt)}</Text>
              )}
            </View>
            <Text style={styles.dmItemPreview} numberOfLines={1}>
              {lastMessage}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [usersById, presenceById, handleDmTap],
  );

  // ── Render Friend Item ─────────────────────────────────────────────────

  const renderFriendItem = useCallback(
    ({ item: rel }: { item: Relationship }) => {
      const user = usersById.get(rel.targetId);
      if (!user) return null;

      const presenceStatus = presenceById.get(user.id) ?? 'offline';

      // Pending tab
      if (rel.type === 'pending_incoming' || rel.type === 'pending_outgoing') {
        const isIncoming = rel.type === 'pending_incoming';
        return (
          <View style={styles.friendCard}>
            <TouchableOpacity
              style={styles.friendCardInner}
              onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
              activeOpacity={0.7}
            >
              <Avatar size={44} userId={user.id} avatarHash={user.avatarHash ?? undefined} displayName={user.displayName} username={user.username} />
              <View style={styles.friendInfo}>
                <Text style={styles.friendName} numberOfLines={1}>
                  {user.displayName}
                </Text>
                <Text style={styles.friendUsername} numberOfLines={1}>
                  @{user.username}
                </Text>
              </View>
              <View
                style={[
                  styles.pendingBadge,
                  isIncoming ? styles.pendingIncoming : styles.pendingOutgoing,
                ]}
              >
                <Text
                  style={[
                    styles.pendingBadgeText,
                    isIncoming ? styles.pendingIncomingText : styles.pendingOutgoingText,
                  ]}
                >
                  {isIncoming ? 'Incoming' : 'Outgoing'}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={styles.pendingActions}>
              {isIncoming ? (
                <>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => acceptMutation.mutate(user.id)}
                    disabled={acceptMutation.isPending}
                    activeOpacity={0.7}
                  >
                    {acceptMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.acceptButtonText}>{'\u2713'} Accept</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineButton}
                    onPress={() => declineMutation.mutate(user.id)}
                    disabled={declineMutation.isPending}
                    activeOpacity={0.7}
                  >
                    {declineMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.accent.error} />
                    ) : (
                      <Text style={styles.declineButtonText}>{'\u2715'} Decline</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => declineMutation.mutate(user.id)}
                  disabled={declineMutation.isPending}
                  activeOpacity={0.7}
                >
                  {declineMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.text.secondary} />
                  ) : (
                    <Text style={styles.cancelButtonText}>Cancel Request</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      }

      // Blocked tab
      if (rel.type === 'blocked') {
        return (
          <View style={styles.friendCard}>
            <View style={styles.friendCardInner}>
              <Avatar size={44} userId={user.id} avatarHash={user.avatarHash ?? undefined} displayName={user.displayName} username={user.username} />
              <View style={styles.friendInfo}>
                <Text style={styles.friendName} numberOfLines={1}>
                  {user.displayName}
                </Text>
                <Text style={styles.friendUsername} numberOfLines={1}>
                  @{user.username}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.unblockButton}
                onPress={() => unblockMutation.mutate(user.id)}
                disabled={unblockMutation.isPending}
                activeOpacity={0.7}
              >
                {unblockMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.accent.error} />
                ) : (
                  <Text style={styles.unblockButtonText}>Unblock</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      // Friends (all / online)
      return (
        <Swipeable
          renderRightActions={() => renderRightActions(user.id, user.displayName)}
          overshootRight={false}
        >
          <TouchableOpacity
            style={styles.friendCard}
            onPress={() => handleOpenDm(user.id)}
            activeOpacity={0.7}
          >
            <View style={styles.friendCardInner}>
              <Avatar
                size={44}
                userId={user.id}
                avatarHash={user.avatarHash ?? undefined}
                displayName={user.displayName}
                username={user.username}
                showPresence
                presenceStatus={presenceStatus as PresenceStatusType}
              />
              <View style={styles.friendInfo}>
                <Text style={styles.friendName} numberOfLines={1}>
                  {user.displayName}
                </Text>
                <Text style={styles.friendUsername} numberOfLines={1}>
                  @{user.username}
                </Text>
              </View>
              <View
                style={[
                  styles.statusChip,
                  { backgroundColor: getPresenceColor(presenceStatus) + '20' },
                ]}
              >
                <View
                  style={[
                    styles.statusChipDot,
                    { backgroundColor: getPresenceColor(presenceStatus) },
                  ]}
                />
                <Text
                  style={[
                    styles.statusChipText,
                    { color: getPresenceColor(presenceStatus) },
                  ]}
                >
                  {presenceStatus === 'dnd' ? 'Do Not Disturb' : presenceStatus.charAt(0).toUpperCase() + presenceStatus.slice(1)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </Swipeable>
      );
    },
    [
      usersById,
      presenceById,
      navigation,
      acceptMutation,
      declineMutation,
      unblockMutation,
      renderRightActions,
      handleOpenDm,
    ],
  );

  // ── List Header (DMs + Section Headers) ────────────────────────────────

  const sortedDms = useMemo(() => {
    return [...dmChannels].sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [dmChannels]);

  const ListHeader = useMemo(() => {
    return (
      <View>
        {/* DM Conversations Section */}
        {sortedDms.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Direct Messages</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{sortedDms.length}</Text>
              </View>
            </View>
            <View style={styles.dmList}>
              {sortedDms.map(renderDmItem)}
            </View>
          </View>
        )}

        {/* Friends Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {filter === 'pending'
              ? 'Pending'
              : filter === 'blocked'
                ? 'Blocked'
                : 'Friends'}
          </Text>
          {(filter === 'all' || filter === 'online') && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {filter === 'online' ? onlineCount : filteredRelationships.length}
              </Text>
            </View>
          )}
          {filter === 'pending' && pendingCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }, [sortedDms, renderDmItem, filter, onlineCount, filteredRelationships.length, pendingCount]);

  // ── Loading state ──────────────────────────────────────────────────────

  if (relLoading && relationships.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Main Render ────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Home</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('NewDm')}
            activeOpacity={0.7}
          >
            <Text style={styles.headerButtonIcon}>{'\u270E'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
        style={styles.filterBarOuter}
      >
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterPill,
              filter === f.key && styles.filterPillActive,
            ]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterPillText,
                filter === f.key && styles.filterPillTextActive,
              ]}
            >
              {f.label}
            </Text>
            {f.count !== undefined && (
              <View
                style={[
                  styles.filterPillCount,
                  filter === f.key && styles.filterPillCountActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillCountText,
                    filter === f.key && styles.filterPillCountTextActive,
                  ]}
                >
                  {f.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <FlashList
        data={filteredRelationships}
        renderItem={renderFriendItem}
        keyExtractor={(item) => `${item.type}-${item.targetId}`}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>
              {filter === 'pending' ? '\u23F3' : filter === 'blocked' ? '\u26D4' : '\u263A'}
            </Text>
            <Text style={styles.emptyText}>{emptyMessages[filter]}</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.brand.primary}
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.primary,
  },
  headerTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonIcon: {
    fontSize: 18,
    color: colors.text.primary,
  },

  // Filter bar
  filterBarOuter: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.primary,
  },
  filterBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bg.elevated,
    gap: spacing.xs,
  },
  filterPillActive: {
    backgroundColor: colors.brand.primary,
  },
  filterPillText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  filterPillCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterPillCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterPillCountText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  filterPillCountTextActive: {
    color: '#ffffff',
  },

  // List
  listContent: {
    paddingBottom: spacing['5xl'],
  },

  // Section
  section: {
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  countBadge: {
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.secondary,
  },

  // DM list
  dmList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  dmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke.primary,
    gap: spacing.md,
  },
  dmItemContent: {
    flex: 1,
  },
  dmItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  dmItemName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  dmItemTime: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginLeft: spacing.sm,
  },
  dmItemPreview: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },

  // Friend Card
  friendCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke.primary,
    overflow: 'hidden',
  },
  friendCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  friendInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  friendName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  friendUsername: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    marginTop: 1,
  },

  // Status chip
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: 5,
  },
  statusChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },

  // Pending actions
  pendingBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  pendingIncoming: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  pendingOutgoing: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  pendingBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  pendingIncomingText: {
    color: colors.accent.success,
  },
  pendingOutgoingText: {
    color: colors.accent.warning,
  },
  pendingActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.stroke.primary,
  },
  acceptButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  acceptButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.accent.success,
  },
  declineButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.stroke.primary,
  },
  declineButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.accent.error,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  cancelButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },

  // Unblock
  unblockButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent.error,
  },
  unblockButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.accent.error,
  },

  // Swipe actions
  swipeActions: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    marginRight: spacing.lg,
  },
  swipeActionMessage: {
    width: 72,
    backgroundColor: colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  swipeActionRemove: {
    width: 72,
    backgroundColor: colors.accent.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  swipeActionText: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 2,
  },
  swipeActionLabel: {
    fontSize: fontSize.xs,
    color: '#ffffff',
    fontWeight: '600',
  },

  // Avatar
  avatar: {
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.brand.primary,
    fontWeight: '700',
  },
  presenceDotOuter: {
    position: 'absolute',
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceDot: {},

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing['3xl'],
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
