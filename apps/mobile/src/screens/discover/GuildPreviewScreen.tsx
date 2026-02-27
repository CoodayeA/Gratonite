import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { DiscoverStackParamList } from '../../navigation/types';
import { Image } from 'expo-image';
import { guildsApi, channelsApi, invitesApi, getFileUrl } from '../../lib/api';
import { colors, fontSize, spacing, radius } from '../../theme';

// ── Types ─────────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<DiscoverStackParamList, 'GuildPreview'>;
type Route = RouteProp<DiscoverStackParamList, 'GuildPreview'>;

interface GuildPreview {
  id: string;
  name: string;
  description?: string;
  iconHash?: string;
  memberCount?: number;
  boostTier?: number;
  tags?: string[];
  features?: string[];
  ownerId?: string;
  isMember?: boolean;
}

interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'announcement' | 'forum';
  position?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 45%)`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatMemberCount(count?: number): string {
  if (!count) return '0';
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function getChannelIcon(type: string): string {
  switch (type) {
    case 'voice':
      return '\uD83D\uDD0A';
    case 'announcement':
      return '\uD83D\uDCE2';
    case 'forum':
      return '\uD83D\uDCAC';
    default:
      return '#';
  }
}

function getBoostLabel(tier?: number): string | null {
  if (!tier || tier === 0) return null;
  if (tier === 1) return 'Level 1';
  if (tier === 2) return 'Level 2';
  return 'Level 3';
}

// ── Main Screen ───────────────────────────────────────────────────────────

export function GuildPreviewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const queryClient = useQueryClient();
  const { guildId } = route.params;

  // ── Data Fetching ─────────────────────────────────────────────────────

  const {
    data: guild,
    isLoading: guildLoading,
  } = useQuery<GuildPreview>({
    queryKey: ['guild-preview', guildId],
    queryFn: () => guildsApi.get(guildId),
  });

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['guild-channels', guildId],
    queryFn: () => channelsApi.getGuildChannels(guildId),
    enabled: !!guild,
  });

  const { data: myGuilds = [] } = useQuery<Array<{ id: string }>>({
    queryKey: ['guilds'],
    queryFn: () => guildsApi.getMine(),
  });

  const isMember = useMemo(
    () => myGuilds.some((g) => g.id === guildId),
    [myGuilds, guildId],
  );

  // ── Join Mutation ─────────────────────────────────────────────────────

  const joinMutation = useMutation({
    mutationFn: async () => {
      // Try joining via discover endpoint, fall back to invite
      await invitesApi.accept(guildId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guilds'] });
      queryClient.invalidateQueries({ queryKey: ['guild-preview', guildId] });
      Alert.alert('Joined!', `You have joined ${guild?.name ?? 'this portal'}.`);
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Could not join portal.');
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleJoin = useCallback(() => {
    joinMutation.mutate();
  }, [joinMutation]);

  const handleGoToPortal = useCallback(() => {
    // Navigate back and let the user go via portals tab
    navigation.goBack();
  }, [navigation]);

  // ── Preview channels ──────────────────────────────────────────────────

  const previewChannels = useMemo(
    () =>
      [...channels]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .slice(0, 5),
    [channels],
  );

  const boostLabel = getBoostLabel(guild?.boostTier);

  // ── Loading ───────────────────────────────────────────────────────────

  if (guildLoading || !guild) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  const bgColor = stringToColor(guild.id);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Area */}
        <View style={[styles.banner, { backgroundColor: bgColor }]}>
          <View style={styles.bannerOverlay} />
          <View style={styles.guildIconContainer}>
            {guild.iconHash ? (
              <Image
                source={{ uri: getFileUrl(guild.iconHash) }}
                style={[styles.guildIcon, { backgroundColor: bgColor }]}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.guildIcon, { backgroundColor: bgColor }]}>
                <Text style={styles.guildIconText}>{getInitials(guild.name)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Guild Info */}
        <View style={styles.infoSection}>
          <Text style={styles.guildName}>{guild.name}</Text>
          {guild.description ? (
            <Text style={styles.guildDescription}>{guild.description}</Text>
          ) : null}

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={styles.memberDot} />
              <Text style={styles.statValue}>
                {formatMemberCount(guild.memberCount)}
              </Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            {boostLabel && (
              <View style={styles.statItem}>
                <Text style={styles.boostIcon}>{'\u26A1'}</Text>
                <Text style={styles.statValue}>{boostLabel}</Text>
                <Text style={styles.statLabel}>Boost</Text>
              </View>
            )}
          </View>

          {/* Tags */}
          {guild.tags && guild.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {guild.tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Channel Preview */}
        {previewChannels.length > 0 && (
          <View style={styles.channelSection}>
            <Text style={styles.sectionTitle}>CHANNELS</Text>
            {previewChannels.map((channel) => (
              <View key={channel.id} style={styles.channelItem}>
                <Text style={styles.channelIcon}>
                  {getChannelIcon(channel.type)}
                </Text>
                <Text style={styles.channelName}>{channel.name}</Text>
              </View>
            ))}
            {channels.length > 5 && (
              <Text style={styles.moreChannels}>
                +{channels.length - 5} more channels
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomAction}>
        {isMember ? (
          <TouchableOpacity
            style={styles.goToButton}
            onPress={handleGoToPortal}
            activeOpacity={0.8}
          >
            <Text style={styles.goToButtonText}>Go to Portal</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.joinActionButton,
              joinMutation.isPending && styles.joinActionButtonDisabled,
            ]}
            onPress={handleJoin}
            disabled={joinMutation.isPending}
            activeOpacity={0.8}
          >
            {joinMutation.isPending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.joinActionButtonText}>Join Portal</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },

  // Banner
  banner: {
    height: 160,
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  guildIconContainer: {
    position: 'absolute',
    bottom: -36,
    alignSelf: 'center',
    borderRadius: 40,
    borderWidth: 4,
    borderColor: colors.bg.primary,
    borderStyle: 'solid',
  },
  guildIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guildIconText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: fontSize['2xl'],
  },

  // Info Section
  infoSection: {
    paddingTop: spacing['4xl'] + spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  guildName: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  guildDescription: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing['3xl'],
    marginBottom: spacing.lg,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  memberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.online,
  },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },
  boostIcon: {
    fontSize: 14,
  },

  // Tags
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  tagChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
  },
  tagText: {
    fontSize: fontSize.xs,
    color: colors.brand.primary,
    fontWeight: '500',
  },

  // Channel Preview
  channelSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  channelIcon: {
    fontSize: 16,
    color: colors.text.muted,
    width: 24,
    textAlign: 'center',
  },
  channelName: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontWeight: '500',
  },
  moreChannels: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Bottom Action
  bottomAction: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.stroke.primary,
    backgroundColor: colors.bg.primary,
  },
  joinActionButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinActionButtonDisabled: {
    opacity: 0.6,
  },
  joinActionButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#ffffff',
  },
  goToButton: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  goToButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.brand.primary,
  },
});
