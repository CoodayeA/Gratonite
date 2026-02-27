import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { relationshipsApi, usersApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { colors, fontSize, spacing, radius } from '../../theme';

// ── Types ─────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'unread' | 'mentions' | 'requests';

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
  unreadCount?: number;
  hasMention?: boolean;
}

interface NotificationItem {
  id: string;
  kind: 'friend_request' | 'mention' | 'unread';
  userId?: string;
  avatarHash?: string | null;
  channelId?: string;
  title: string;
  preview: string;
  time: string;
  isIncoming?: boolean;
  unreadCount?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

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
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// ── Main Screen ───────────────────────────────────────────────────────────

export function NotificationsScreen() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // ── Data Fetching ───────────────────────────────────────────────────────

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

  // Collect user IDs for summaries
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
    for (const u of userSummaries) map.set(u.id, u);
    return map;
  }, [userSummaries]);

  // ── Mutations ───────────────────────────────────────────────────────────

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['relationships'] });
    queryClient.invalidateQueries({ queryKey: ['dm-channels'] });
  }, [queryClient]);

  const acceptMutation = useMutation({
    mutationFn: (userId: string) => relationshipsApi.acceptFriendRequest(userId),
    onSuccess: invalidateAll,
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const declineMutation = useMutation({
    mutationFn: (userId: string) => relationshipsApi.removeFriend(userId),
    onSuccess: invalidateAll,
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  // ── Build notification items ────────────────────────────────────────────

  const pendingRequests = useMemo(
    () =>
      relationships
        .filter((r) => r.type === 'pending_incoming' || r.type === 'pending_outgoing')
        .map((rel): NotificationItem => {
          const user = usersById.get(rel.targetId);
          const isIncoming = rel.type === 'pending_incoming';
          return {
            id: `req-${rel.targetId}`,
            kind: 'friend_request',
            userId: rel.targetId,
            avatarHash: user?.avatarHash,
            title: user?.displayName ?? user?.username ?? 'Unknown',
            preview: isIncoming
              ? 'sent you a friend request'
              : 'Outgoing friend request',
            time: timeAgo(rel.createdAt),
            isIncoming,
          };
        }),
    [relationships, usersById],
  );

  const mentionItems = useMemo(
    () =>
      dmChannels
        .filter((dm) => dm.hasMention)
        .map((dm): NotificationItem => {
          const otherUserId = dm.otherUserId ?? dm.recipientIds?.[0];
          const user = otherUserId ? usersById.get(otherUserId) : undefined;
          return {
            id: `mention-${dm.id}`,
            kind: 'mention',
            userId: otherUserId,
            avatarHash: user?.avatarHash,
            channelId: dm.id,
            title: user?.displayName ?? dm.name ?? 'Unknown',
            preview: dm.lastMessageContent
              ? dm.lastMessageContent.length > 60
                ? dm.lastMessageContent.slice(0, 60) + '...'
                : dm.lastMessageContent
              : 'mentioned you',
            time: timeAgo(dm.lastMessageAt),
          };
        }),
    [dmChannels, usersById],
  );

  const unreadItems = useMemo(
    () =>
      dmChannels
        .filter((dm) => dm.unreadCount && dm.unreadCount > 0)
        .sort((a, b) => {
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        })
        .map((dm): NotificationItem => {
          const otherUserId = dm.otherUserId ?? dm.recipientIds?.[0];
          const user = otherUserId ? usersById.get(otherUserId) : undefined;
          return {
            id: `unread-${dm.id}`,
            kind: 'unread',
            userId: otherUserId,
            avatarHash: user?.avatarHash,
            channelId: dm.id,
            title: user?.displayName ?? dm.name ?? 'Unknown',
            preview: dm.lastMessageContent
              ? dm.lastMessageContent.length > 60
                ? dm.lastMessageContent.slice(0, 60) + '...'
                : dm.lastMessageContent
              : 'New messages',
            time: timeAgo(dm.lastMessageAt),
            unreadCount: dm.unreadCount,
          };
        }),
    [dmChannels, usersById],
  );

  // ── Filtered items ──────────────────────────────────────────────────────

  const allNotifications = useMemo(() => {
    switch (filter) {
      case 'requests':
        return pendingRequests;
      case 'mentions':
        return mentionItems;
      case 'unread':
        return unreadItems;
      case 'all':
      default:
        return [...pendingRequests, ...mentionItems, ...unreadItems];
    }
  }, [filter, pendingRequests, mentionItems, unreadItems]);

  // ── Pull to Refresh ─────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchRels(), refetchDms()]);
    setRefreshing(false);
  }, [refetchRels, refetchDms]);

  // ── Section toggle ──────────────────────────────────────────────────────

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Filter pill data ────────────────────────────────────────────────────

  const filters: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    {
      key: 'unread',
      label: 'Unread',
      count: unreadItems.length > 0 ? unreadItems.length : undefined,
    },
    {
      key: 'mentions',
      label: 'Mentions',
      count: mentionItems.length > 0 ? mentionItems.length : undefined,
    },
    {
      key: 'requests',
      label: 'Requests',
      count: pendingRequests.length > 0 ? pendingRequests.length : undefined,
    },
  ];

  const emptyMessages: Record<FilterTab, { icon: string; title: string; subtitle: string }> = {
    all: {
      icon: '\uD83D\uDCEC',
      title: 'All caught up!',
      subtitle: 'You have no new notifications',
    },
    unread: {
      icon: '\u2705',
      title: 'No unread messages',
      subtitle: 'All messages have been read',
    },
    mentions: {
      icon: '@',
      title: 'No mentions',
      subtitle: 'No one has mentioned you recently',
    },
    requests: {
      icon: '\uD83E\uDD1D',
      title: 'No friend requests',
      subtitle: 'No pending friend requests',
    },
  };

  // ── Render notification item ────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => {
      const isFriendRequest = item.kind === 'friend_request';

      return (
        <View style={styles.notifCard}>
          <View style={styles.notifCardInner}>
            <Avatar size={44} userId={item.userId} avatarHash={item.avatarHash ?? undefined} displayName={item.title} />
            <View style={styles.notifContent}>
              <View style={styles.notifHeader}>
                <Text style={styles.notifTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.notifTime}>{item.time}</Text>
              </View>
              <Text style={styles.notifPreview} numberOfLines={2}>
                {item.preview}
              </Text>
            </View>
            {item.kind === 'unread' && item.unreadCount && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
            {item.kind === 'mention' && (
              <View style={styles.mentionBadge}>
                <Text style={styles.mentionBadgeText}>@</Text>
              </View>
            )}
          </View>

          {/* Friend request actions */}
          {isFriendRequest && item.userId && (
            <View style={styles.requestActions}>
              {item.isIncoming ? (
                <>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => acceptMutation.mutate(item.userId!)}
                    disabled={acceptMutation.isPending}
                    activeOpacity={0.7}
                  >
                    {acceptMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.acceptButtonText}>
                        {'\u2713'} Accept
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineButton}
                    onPress={() => declineMutation.mutate(item.userId!)}
                    disabled={declineMutation.isPending}
                    activeOpacity={0.7}
                  >
                    {declineMutation.isPending ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.accent.error}
                      />
                    ) : (
                      <Text style={styles.declineButtonText}>
                        {'\u2715'} Decline
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => declineMutation.mutate(item.userId!)}
                  disabled={declineMutation.isPending}
                  activeOpacity={0.7}
                >
                  {declineMutation.isPending ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.text.secondary}
                    />
                  ) : (
                    <Text style={styles.cancelButtonText}>Cancel Request</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      );
    },
    [acceptMutation, declineMutation],
  );

  // ── Section Header ──────────────────────────────────────────────────────

  const renderSectionHeader = useCallback(
    (title: string, count: number, sectionKey: string) => {
      const collapsed = collapsedSections[sectionKey];
      return (
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection(sectionKey)}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{count}</Text>
            </View>
          </View>
          <Text style={styles.sectionChevron}>
            {collapsed ? '\u25B6' : '\u25BC'}
          </Text>
        </TouchableOpacity>
      );
    },
    [collapsedSections, toggleSection],
  );

  // ── Loading ─────────────────────────────────────────────────────────────

  if (relLoading && relationships.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const empty = emptyMessages[filter];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inbox</Text>
      </View>

      {/* Filter tabs */}
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
      {filter === 'all' ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.brand.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Friend Requests Section */}
          {pendingRequests.length > 0 && (
            <View>
              {renderSectionHeader(
                'Friend Requests',
                pendingRequests.length,
                'requests',
              )}
              {!collapsedSections['requests'] &&
                pendingRequests.map((item) => (
                  <View key={item.id}>{renderItem({ item })}</View>
                ))}
            </View>
          )}

          {/* Mentions Section */}
          {mentionItems.length > 0 && (
            <View>
              {renderSectionHeader(
                'Mentions',
                mentionItems.length,
                'mentions',
              )}
              {!collapsedSections['mentions'] &&
                mentionItems.map((item) => (
                  <View key={item.id}>{renderItem({ item })}</View>
                ))}
            </View>
          )}

          {/* Unread Messages Section */}
          {unreadItems.length > 0 && (
            <View>
              {renderSectionHeader(
                'Unread Messages',
                unreadItems.length,
                'unread',
              )}
              {!collapsedSections['unread'] &&
                unreadItems.map((item) => (
                  <View key={item.id}>{renderItem({ item })}</View>
                ))}
            </View>
          )}

          {/* All empty */}
          {pendingRequests.length === 0 &&
            mentionItems.length === 0 &&
            unreadItems.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>{empty.icon}</Text>
                <Text style={styles.emptyTitle}>{empty.title}</Text>
                <Text style={styles.emptySubtitle}>{empty.subtitle}</Text>
              </View>
            )}
        </ScrollView>
      ) : (
        <View style={styles.listContainer}>
          <FlashList
            data={allNotifications}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.brand.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>{empty.icon}</Text>
                <Text style={styles.emptyTitle}>{empty.title}</Text>
                <Text style={styles.emptySubtitle}>{empty.subtitle}</Text>
              </View>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

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

  // Scroll view (for "all" tab with sections)
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['5xl'],
  },

  // List
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing['5xl'],
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionChevron: {
    fontSize: 10,
    color: colors.text.muted,
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

  // Notification card
  notifCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke.primary,
    overflow: 'hidden',
  },
  notifCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  notifTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  notifTime: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginLeft: spacing.sm,
  },
  notifPreview: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },

  // Badges
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#ffffff',
  },
  mentionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentionBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Friend request actions
  requestActions: {
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

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'] * 1.5,
    paddingHorizontal: spacing['3xl'],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
