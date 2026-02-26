import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import type { HomeStackParamList } from '../../navigation/types';
import { relationshipsApi, usersApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { colors, spacing, radius, fontSize } from '../../theme';

// ── Types ──────────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<HomeStackParamList, 'NewDm'>;

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

// ── Main Screen ────────────────────────────────────────────────────────────

export function NewDmScreen() {
  const navigation = useNavigation<Nav>();
  const currentUser = useAuthStore((s) => s.user);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch all relationships to get friends
  const { data: relationships = [] } = useQuery<Relationship[]>({
    queryKey: ['relationships'],
    queryFn: () => relationshipsApi.getAll(),
  });

  // Get friend IDs
  const friendIds = useMemo(() => {
    return relationships
      .filter((r) => r.type === 'friend')
      .map((r) => r.targetId);
  }, [relationships]);

  // Fetch user summaries for friends
  const { data: userSummaries = [] } = useQuery<UserSummary[]>({
    queryKey: ['users', 'summaries', friendIds],
    queryFn: () => usersApi.getSummaries(friendIds),
    enabled: friendIds.length > 0,
  });

  // Filter by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return userSummaries;
    const q = searchQuery.toLowerCase();
    return userSummaries.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q),
    );
  }, [userSummaries, searchQuery]);

  // Handle selecting a friend to DM
  const handleSelectUser = useCallback(
    async (user: UserSummary) => {
      setLoading(true);
      try {
        const channel = await relationshipsApi.openDm(user.id);
        if (channel?.id) {
          // Replace current screen in stack so back goes to Friends, not NewDm
          navigation.replace('DmChat', { channelId: channel.id });
        }
      } catch (err: any) {
        Alert.alert('Error', err.message ?? 'Could not open DM channel.');
      } finally {
        setLoading(false);
      }
    },
    [navigation],
  );

  // ── Render Item ────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: UserSummary }) => (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => handleSelectUser(item)}
        activeOpacity={0.7}
        disabled={loading}
      >
        <Avatar size={44} userId={item.id} avatarHash={item.avatarHash ?? undefined} displayName={item.displayName} username={item.username} />
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text style={styles.userUsername} numberOfLines={1}>
            @{item.username}
          </Text>
        </View>
        <View style={styles.chevron}>
          <Text style={styles.chevronText}>{'\u203A'}</Text>
        </View>
      </TouchableOpacity>
    ),
    [handleSelectUser, loading],
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>{'\u2315'}</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <Text style={styles.clearButton}>{'\u2715'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={colors.brand.primary} />
          <Text style={styles.loadingText}>Opening conversation...</Text>
        </View>
      )}

      {/* Friend Count */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {searchQuery.trim() ? 'Results' : 'Friends'}
        </Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{filteredUsers.length}</Text>
        </View>
      </View>

      {/* Friends List */}
      <FlashList
        data={filteredUsers}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{'\u2709'}</Text>
            <Text style={styles.emptyText}>
              {searchQuery.trim()
                ? 'No friends match your search.'
                : 'No friends to message yet.'}
            </Text>
          </View>
        }
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

  // Search
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    gap: spacing.sm,
  },
  searchIcon: {
    fontSize: 18,
    color: colors.text.muted,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text.primary,
    paddingVertical: 0,
  },
  clearButton: {
    fontSize: 14,
    color: colors.text.muted,
    padding: spacing.xs,
  },

  // Loading
  loadingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bg.elevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.primary,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },

  // Section header
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

  // List
  listContent: {
    paddingBottom: spacing['5xl'],
  },

  // User item
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  userUsername: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    marginTop: 1,
  },
  chevron: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronText: {
    fontSize: 22,
    color: colors.text.muted,
    fontWeight: '300',
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
