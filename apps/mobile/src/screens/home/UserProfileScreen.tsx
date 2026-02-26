import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { HomeStackParamList } from '../../navigation/types';
import { usersApi, relationshipsApi, getFileUrl } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { colors, spacing, radius, fontSize } from '../../theme';

// ── Types ──────────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<HomeStackParamList, 'UserProfile'>;
type Route = RouteProp<HomeStackParamList, 'UserProfile'>;

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
  bannerHash: string | null;
  bio: string | null;
  pronouns: string | null;
  accentColor: string | null;
  primaryColor: string | null;
  messageCount: number;
  createdAt: string;
}

interface Relationship {
  userId: string;
  targetId: string;
  type: 'friend' | 'blocked' | 'pending_incoming' | 'pending_outgoing';
  createdAt: string;
}

interface MutualData {
  mutualServers: Array<{ id: string; name: string; iconHash: string | null; nickname: string | null }>;
  mutualFriends: Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function intToHex(color: string | number | null): string | null {
  if (color === null) return null;
  if (typeof color === 'string') return color;
  return '#' + color.toString(16).padStart(6, '0');
}

// ── Main Screen ────────────────────────────────────────────────────────────

export function UserProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId } = route.params;
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const isSelf = currentUser?.id === userId;

  // ── Data Fetching ──────────────────────────────────────────────────────

  const {
    data: profile,
    isLoading: profileLoading,
  } = useQuery<UserProfile>({
    queryKey: ['user-profile', userId],
    queryFn: () => usersApi.getProfile(userId),
  });

  const { data: relationships = [] } = useQuery<Relationship[]>({
    queryKey: ['relationships'],
    queryFn: () => relationshipsApi.getAll(),
  });

  const { data: mutuals } = useQuery<MutualData>({
    queryKey: ['user-mutuals', userId],
    queryFn: () => usersApi.getMutuals(userId),
    enabled: !isSelf,
  });

  // Determine relationship with this user
  const relationship = useMemo(() => {
    return relationships.find(
      (r) => r.targetId === userId || r.userId === userId,
    );
  }, [relationships, userId]);

  const isFriend = relationship?.type === 'friend';
  const isBlocked = relationship?.type === 'blocked';
  const isPendingIncoming = relationship?.type === 'pending_incoming';
  const isPendingOutgoing = relationship?.type === 'pending_outgoing';

  // ── Mutations ──────────────────────────────────────────────────────────

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['relationships'] });
  }, [queryClient]);

  const addFriendMutation = useMutation({
    mutationFn: () => relationshipsApi.sendFriendRequest(userId),
    onSuccess: invalidateAll,
  });

  const removeFriendMutation = useMutation({
    mutationFn: () => relationshipsApi.removeFriend(userId),
    onSuccess: invalidateAll,
  });

  const acceptMutation = useMutation({
    mutationFn: () => relationshipsApi.acceptFriendRequest(userId),
    onSuccess: invalidateAll,
  });

  const blockMutation = useMutation({
    mutationFn: () => relationshipsApi.block(userId),
    onSuccess: invalidateAll,
  });

  const unblockMutation = useMutation({
    mutationFn: () => relationshipsApi.unblock(userId),
    onSuccess: invalidateAll,
  });

  // ── Action Handlers ────────────────────────────────────────────────────

  const handleMessage = useCallback(async () => {
    try {
      const channel = await relationshipsApi.openDm(userId);
      if (channel?.id) {
        navigation.navigate('DmChat', { channelId: channel.id });
      }
    } catch {
      Alert.alert('Error', 'Could not open DM channel.');
    }
  }, [userId, navigation]);

  const handleRemoveFriend = useCallback(() => {
    Alert.alert(
      'Remove Friend',
      `Remove ${profile?.displayName ?? 'this user'} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFriendMutation.mutate(),
        },
      ],
    );
  }, [profile?.displayName, removeFriendMutation]);

  const handleBlock = useCallback(() => {
    Alert.alert(
      'Block User',
      `Block ${profile?.displayName ?? 'this user'}? They won't be able to message you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => blockMutation.mutate(),
        },
      ],
    );
  }, [profile?.displayName, blockMutation]);

  // ── Banner Color ───────────────────────────────────────────────────────

  const bannerColor = useMemo(() => {
    const accent = intToHex(profile?.accentColor ?? null);
    const primary = intToHex(profile?.primaryColor ?? null);
    return accent ?? primary ?? colors.brand.primary;
  }, [profile]);

  // ── Loading ────────────────────────────────────────────────────────────

  if (profileLoading || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        bounces
      >
        {/* Banner */}
        {profile.bannerHash ? (
          <Image
            source={{ uri: getFileUrl(profile.bannerHash) }}
            style={styles.banner}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.banner, { backgroundColor: bannerColor }]} />
        )}

        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Avatar - overlaps banner */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarRing}>
              <Avatar
                size={84}
                userId={profile.id}
                avatarHash={profile.avatarHash ?? undefined}
                displayName={profile.displayName}
                username={profile.username}
              />
            </View>
          </View>

          {/* Name & Username */}
          <View style={styles.nameSection}>
            <Text style={styles.displayName}>{profile.displayName}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
          </View>

          {/* Pronouns */}
          {profile.pronouns && (
            <View style={styles.pronounsContainer}>
              <Text style={styles.pronounsText}>{profile.pronouns}</Text>
            </View>
          )}

          {/* Bio */}
          {profile.bio && (
            <View style={styles.bioSection}>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          )}

          {/* Separator */}
          <View style={styles.separator} />

          {/* Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>{formatDate(profile.createdAt)}</Text>
            </View>
            {profile.messageCount > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Messages</Text>
                <Text style={styles.infoValue}>
                  {profile.messageCount.toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          {/* Mutual Servers & Friends */}
          {mutuals && (mutuals.mutualServers.length > 0 || mutuals.mutualFriends.length > 0) && (
            <>
              <View style={styles.separator} />
              <View style={styles.mutualsSection}>
                {mutuals.mutualServers.length > 0 && (
                  <View style={styles.mutualRow}>
                    <Text style={styles.mutualLabel}>
                      {mutuals.mutualServers.length} Mutual Server{mutuals.mutualServers.length !== 1 ? 's' : ''}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.mutualChips}
                    >
                      {mutuals.mutualServers.map((server) => (
                        <View key={server.id} style={styles.mutualChip}>
                          <Text style={styles.mutualChipText} numberOfLines={1}>
                            {server.name}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
                {mutuals.mutualFriends.length > 0 && (
                  <View style={styles.mutualRow}>
                    <Text style={styles.mutualLabel}>
                      {mutuals.mutualFriends.length} Mutual Friend{mutuals.mutualFriends.length !== 1 ? 's' : ''}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.mutualChips}
                    >
                      {mutuals.mutualFriends.map((friend) => (
                        <View key={friend.id} style={styles.mutualChip}>
                          <Text style={styles.mutualChipText} numberOfLines={1}>
                            {friend.displayName}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Action Buttons */}
          {!isSelf && (
            <>
              <View style={styles.separator} />
              <View style={styles.actionsSection}>
                {/* Message Button */}
                {!isBlocked && (
                  <TouchableOpacity
                    style={styles.actionButtonPrimary}
                    onPress={handleMessage}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionButtonPrimaryIcon}>{'\u2709'}</Text>
                    <Text style={styles.actionButtonPrimaryText}>Message</Text>
                  </TouchableOpacity>
                )}

                {/* Friend Actions */}
                {isFriend && (
                  <TouchableOpacity
                    style={styles.actionButtonDanger}
                    onPress={handleRemoveFriend}
                    activeOpacity={0.7}
                    disabled={removeFriendMutation.isPending}
                  >
                    {removeFriendMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.accent.error} />
                    ) : (
                      <>
                        <Text style={styles.actionButtonDangerIcon}>{'\u2715'}</Text>
                        <Text style={styles.actionButtonDangerText}>Remove Friend</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Add Friend (if no relationship) */}
                {!relationship && !isBlocked && (
                  <TouchableOpacity
                    style={styles.actionButtonSecondary}
                    onPress={() => addFriendMutation.mutate()}
                    activeOpacity={0.7}
                    disabled={addFriendMutation.isPending}
                  >
                    {addFriendMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.brand.primary} />
                    ) : (
                      <>
                        <Text style={styles.actionButtonSecondaryIcon}>{'\u002B'}</Text>
                        <Text style={styles.actionButtonSecondaryText}>Add Friend</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Pending Incoming */}
                {isPendingIncoming && (
                  <TouchableOpacity
                    style={styles.actionButtonSecondary}
                    onPress={() => acceptMutation.mutate()}
                    activeOpacity={0.7}
                    disabled={acceptMutation.isPending}
                  >
                    {acceptMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.accent.success} />
                    ) : (
                      <>
                        <Text style={[styles.actionButtonSecondaryIcon, { color: colors.accent.success }]}>
                          {'\u2713'}
                        </Text>
                        <Text style={[styles.actionButtonSecondaryText, { color: colors.accent.success }]}>
                          Accept Friend Request
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Pending Outgoing */}
                {isPendingOutgoing && (
                  <View style={styles.pendingOutgoingBanner}>
                    <Text style={styles.pendingOutgoingText}>Friend request sent</Text>
                  </View>
                )}

                {/* Block / Unblock */}
                {isBlocked ? (
                  <TouchableOpacity
                    style={styles.actionButtonDanger}
                    onPress={() => unblockMutation.mutate()}
                    activeOpacity={0.7}
                    disabled={unblockMutation.isPending}
                  >
                    {unblockMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.accent.error} />
                    ) : (
                      <Text style={styles.actionButtonDangerText}>Unblock</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.blockButton}
                    onPress={handleBlock}
                    activeOpacity={0.7}
                    disabled={blockMutation.isPending}
                  >
                    {blockMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.accent.error} />
                    ) : (
                      <Text style={styles.blockButtonText}>Block</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['5xl'],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Banner
  banner: {
    height: 140,
  },

  // Profile Card
  profileCard: {
    backgroundColor: colors.bg.surface,
    marginTop: -20,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.lg,
    minHeight: 400,
  },

  // Avatar
  avatarContainer: {
    alignItems: 'flex-start',
    marginTop: -44,
    paddingHorizontal: spacing.lg,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  avatarLarge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.brand.primary,
  },

  // Name
  nameSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  displayName: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: colors.text.primary,
  },
  username: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Pronouns
  pronounsContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  pronounsText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    fontStyle: 'italic',
  },

  // Bio
  bioSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  bioText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    lineHeight: 22,
  },

  // Separator
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.stroke.primary,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.lg,
  },

  // Info
  infoSection: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: fontSize.md,
    color: colors.text.primary,
  },

  // Mutuals
  mutualsSection: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  mutualRow: {
    gap: spacing.sm,
  },
  mutualLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  mutualChips: {
    gap: spacing.sm,
  },
  mutualChip: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke.primary,
  },
  mutualChipText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    maxWidth: 120,
  },

  // Actions
  actionsSection: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  actionButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  actionButtonPrimaryIcon: {
    fontSize: 16,
    color: '#ffffff',
  },
  actionButtonPrimaryText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.stroke.secondary,
    gap: spacing.sm,
  },
  actionButtonSecondaryIcon: {
    fontSize: 16,
    color: colors.brand.primary,
  },
  actionButtonSecondaryText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.brand.primary,
  },
  actionButtonDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    gap: spacing.sm,
  },
  actionButtonDangerIcon: {
    fontSize: 14,
    color: colors.accent.error,
  },
  actionButtonDangerText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.accent.error,
  },
  blockButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  blockButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.muted,
  },
  pendingOutgoingBanner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  pendingOutgoingText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.accent.warning,
  },
});
