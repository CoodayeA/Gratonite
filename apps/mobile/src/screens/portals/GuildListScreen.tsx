import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PortalsStackParamList } from '../../navigation/types';
import { guildsApi, getFileUrl } from '../../lib/api';
import { colors, fontSize, spacing, radius } from '../../theme';

type Nav = NativeStackNavigationProp<PortalsStackParamList, 'GuildList'>;

interface Guild {
  id: string;
  name: string;
  ownerId: string;
  iconHash?: string;
  description?: string;
  memberCount?: number;
  boostTier?: number;
  features?: string[];
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 45%)`;
}

function GuildIcon({ guild, size }: { guild: Guild; size: number }) {
  const bgColor = stringToColor(guild.id);
  const initials = guild.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const imageUri = guild.iconHash ? getFileUrl(guild.iconHash) : null;
  const borderRadius = size * 0.22;

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: bgColor,
        }}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <View
      style={[
        styles.guildIcon,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Text style={[styles.guildIconText, { fontSize: size * 0.35 }]}>
        {initials}
      </Text>
    </View>
  );
}

export function GuildListScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newGuildName, setNewGuildName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: guilds = [],
    isLoading,
    refetch,
  } = useQuery<Guild[]>({
    queryKey: ['guilds'],
    queryFn: () => guildsApi.getMine(),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => guildsApi.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guilds'] });
      setNewGuildName('');
      setShowCreate(false);
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  const filteredGuilds = searchQuery
    ? guilds.filter((g) =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : guilds;

  const handleGuildPress = useCallback(
    (guild: Guild) => {
      navigation.navigate('Guild', { guildId: guild.id });
    },
    [navigation],
  );

  const handleCreateGuild = useCallback(() => {
    const name = newGuildName.trim();
    if (!name) return;
    createMutation.mutate(name);
  }, [newGuildName, createMutation]);

  const renderGuildRow = useCallback(
    ({ item }: { item: Guild }) => (
      <TouchableOpacity
        style={styles.guildRow}
        activeOpacity={0.7}
        onPress={() => handleGuildPress(item)}
      >
        <GuildIcon guild={item} size={44} />
        <View style={styles.guildInfo}>
          <Text style={styles.guildName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.description ? (
            <Text style={styles.guildDesc} numberOfLines={1}>
              {item.description}
            </Text>
          ) : (
            <Text style={styles.guildDesc}>
              {item.memberCount ?? 0} members
            </Text>
          )}
        </View>
        <View style={styles.guildTrailing}>
          {item.boostTier && item.boostTier > 0 ? (
            <Text style={styles.boostBadge}>
              {'\u26A1'.repeat(Math.min(item.boostTier, 3))}
            </Text>
          ) : null}
          {/* Notification dot placeholder — will show unread state when socket events feed it */}
          <View style={styles.chevron}>
            <Text style={styles.chevronText}>{'\u203A'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    ),
    [handleGuildPress],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Portals</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreate(!showCreate)}
          activeOpacity={0.7}
        >
          <Text style={styles.createButtonText}>
            {showCreate ? '\u2715' : '+'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search / filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>{'\uD83D\uDD0D'}</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search portals..."
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Create guild form */}
      {showCreate && (
        <View style={styles.createForm}>
          <TextInput
            style={styles.createInput}
            placeholder="Portal name..."
            placeholderTextColor={colors.text.muted}
            value={newGuildName}
            onChangeText={setNewGuildName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreateGuild}
          />
          <TouchableOpacity
            style={[
              styles.createSubmit,
              (!newGuildName.trim() || createMutation.isPending) &&
                styles.createSubmitDisabled,
            ]}
            onPress={handleCreateGuild}
            disabled={!newGuildName.trim() || createMutation.isPending}
            activeOpacity={0.7}
          >
            <Text style={styles.createSubmitText}>
              {createMutation.isPending ? '...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Guild count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {filteredGuilds.length} portal{filteredGuilds.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Guild list */}
      <View style={styles.listContainer}>
        {filteredGuilds.length === 0 && !isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'\uD83C\uDFF0'}</Text>
            <Text style={styles.emptyTitle}>No portals yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a portal or join one from Discover
            </Text>
          </View>
        ) : (
          <FlashList
            data={filteredGuilds}
            renderItem={renderGuildRow}
            keyExtractor={(item) => item.id}

            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={refetch}
                tintColor={colors.brand.primary}
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: colors.text.primary,
  },
  createButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    fontSize: fontSize.lg,
    color: '#ffffff',
    fontWeight: '600',
  },

  // Search
  searchContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text.primary,
  },

  // Create form
  createForm: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  createInput: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  createSubmit: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  createSubmitDisabled: {
    opacity: 0.5,
  },
  createSubmitText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: fontSize.md,
  },

  // Count
  countRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  countText: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // List
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
  },

  // Guild row
  guildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke.primary,
  },
  guildIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  guildIconText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  guildInfo: {
    flex: 1,
  },
  guildName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  guildDesc: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
  guildTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  boostBadge: {
    fontSize: 12,
  },
  chevron: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronText: {
    fontSize: 20,
    color: colors.text.muted,
    fontWeight: '300',
  },

  // Empty
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['4xl'],
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
  },
});
