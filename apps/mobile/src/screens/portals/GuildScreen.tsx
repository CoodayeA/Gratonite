import React, { useCallback, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { PortalsStackParamList } from '../../navigation/types';
import type { Channel, ChannelType } from '@gratonite/types';
import { guildsApi, channelsApi, invitesApi } from '../../lib/api';
import { colors, fontSize, spacing, radius } from '../../theme';

type Nav = NativeStackNavigationProp<PortalsStackParamList, 'Guild'>;
type Route = RouteProp<PortalsStackParamList, 'Guild'>;

// ---------------------------------------------------------------------------
// Channel type icon mapping
// ---------------------------------------------------------------------------
const CHANNEL_ICONS: Partial<Record<ChannelType, string>> = {
  GUILD_TEXT: '#',
  GUILD_VOICE: '\uD83D\uDD0A', // speaker
  GUILD_ANNOUNCEMENT: '\uD83D\uDCE2', // megaphone
  GUILD_STAGE_VOICE: '\uD83C\uDFAD', // masks
  GUILD_FORUM: '\uD83D\uDCAC', // speech bubble
};

const VOICE_TYPES: ChannelType[] = ['GUILD_VOICE', 'GUILD_STAGE_VOICE'];
const NAVIGABLE_TYPES: ChannelType[] = [
  'GUILD_TEXT',
  'GUILD_ANNOUNCEMENT',
  'GUILD_FORUM',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 45%)`;
}

function guildInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GuildData {
  id: string;
  name: string;
  ownerId: string;
  iconHash?: string | null;
  description?: string | null;
  memberCount?: number;
}

interface ChannelSection {
  title: string;
  count: number;
  data: Channel[];
}

// ---------------------------------------------------------------------------
// Header component
// ---------------------------------------------------------------------------
function GuildHeaderRight({ guildId }: { guildId: string }) {
  const navigation = useNavigation<Nav>();
  return (
    <TouchableOpacity
      style={styles.headerAction}
      onPress={() => navigation.navigate('GuildSettings', { guildId })}
      activeOpacity={0.7}
    >
      <Text style={styles.headerActionText}>{'\u2699\uFE0F'}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Channel Row
// ---------------------------------------------------------------------------
const ChannelRow = React.memo(function ChannelRow({
  channel,
  onPress,
}: {
  channel: Channel;
  onPress: (ch: Channel) => void;
}) {
  const isVoice = VOICE_TYPES.includes(channel.type);
  const icon = CHANNEL_ICONS[channel.type] ?? '#';

  return (
    <TouchableOpacity
      style={styles.channelRow}
      activeOpacity={0.6}
      onPress={() => onPress(channel)}
    >
      <Text style={[styles.channelIcon, isVoice && styles.channelIconVoice]}>
        {icon}
      </Text>
      <View style={styles.channelInfo}>
        <View style={styles.channelNameRow}>
          <Text
            style={[styles.channelName, isVoice && styles.channelNameVoice]}
            numberOfLines={1}
          >
            {channel.name}
          </Text>
          {channel.nsfw && (
            <View style={styles.nsfwBadge}>
              <Text style={styles.nsfwBadgeText}>NSFW</Text>
            </View>
          )}
        </View>
        {channel.topic && !isVoice ? (
          <Text style={styles.channelTopic} numberOfLines={1}>
            {channel.topic}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------
function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
export function GuildScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { guildId } = route.params;

  // -- Data fetching --------------------------------------------------------
  const {
    data: guild,
    isLoading: guildLoading,
  } = useQuery<GuildData>({
    queryKey: ['guild', guildId],
    queryFn: () => guildsApi.get(guildId),
  });

  const {
    data: channels = [],
    isLoading: channelsLoading,
  } = useQuery<Channel[]>({
    queryKey: ['guild-channels', guildId],
    queryFn: () => channelsApi.getGuildChannels(guildId),
  });

  // -- Portal menu handlers --------------------------------------------------
  const handleCreateInvite = useCallback(async () => {
    try {
      const firstText = channels.find((c) => c.type === 'GUILD_TEXT');
      if (!firstText) {
        Alert.alert('Error', 'No text channels to create invite for.');
        return;
      }
      const invite = await invitesApi.create(guildId, { channelId: firstText.id, maxAgeSeconds: 86400 });
      const url = `https://gratonite.chat/invite/${invite.code}`;
      Alert.alert('Invite Link', url, [
        {
          text: 'Copy',
          onPress: () => {
            try {
              const Clipboard = require('expo-clipboard');
              Clipboard.setStringAsync(url);
            } catch {}
          },
        },
        { text: 'OK' },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to create invite');
    }
  }, [channels, guildId]);

  const handlePortalMenu = useCallback(() => {
    const options = ['Members', 'Pinned Messages', 'Invite People', 'Portal Settings', 'Cancel'];
    const cancelIndex = options.length - 1;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        (buttonIndex) => {
          switch (options[buttonIndex]) {
            case 'Members':
              navigation.navigate('GuildMembers', { guildId });
              break;
            case 'Pinned Messages': {
              const firstText = channels.find((c) => c.type === 'GUILD_TEXT');
              if (firstText) {
                navigation.navigate('PinnedMessages', { guildId, channelId: firstText.id });
              }
              break;
            }
            case 'Invite People':
              handleCreateInvite();
              break;
            case 'Portal Settings':
              navigation.navigate('GuildSettings', { guildId });
              break;
          }
        },
      );
    } else {
      Alert.alert('Portal Menu', undefined, [
        { text: 'Members', onPress: () => navigation.navigate('GuildMembers', { guildId }) },
        {
          text: 'Pinned Messages',
          onPress: () => {
            const firstText = channels.find((c) => c.type === 'GUILD_TEXT');
            if (firstText) navigation.navigate('PinnedMessages', { guildId, channelId: firstText.id });
          },
        },
        { text: 'Invite People', onPress: handleCreateInvite },
        { text: 'Portal Settings', onPress: () => navigation.navigate('GuildSettings', { guildId }) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [navigation, guildId, channels, handleCreateInvite]);

  // -- Navigation header ----------------------------------------------------
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity
          style={styles.headerTitleContainer}
          onPress={handlePortalMenu}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.headerIcon,
              { backgroundColor: stringToColor(guildId) },
            ]}
          >
            <Text style={styles.headerIconText}>
              {guild ? guildInitials(guild.name) : '..'}
            </Text>
          </View>
          <View style={styles.headerTitleInfo}>
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {guild?.name ?? 'Loading...'}
            </Text>
            {guild?.memberCount != null && (
              <Text style={styles.headerSubtitleText}>
                {guild.memberCount} members
              </Text>
            )}
          </View>
          <Text style={styles.headerChevron}>{'\u203A'}</Text>
        </TouchableOpacity>
      ),
      headerRight: () => <GuildHeaderRight guildId={guildId} />,
      headerBlurEffect: 'dark',
      headerTransparent: true,
    });
  }, [navigation, guild, guildId, handlePortalMenu]);

  // -- Organize channels into sections --------------------------------------
  const sections: ChannelSection[] = useMemo(() => {
    const categories = channels
      .filter((c) => c.type === 'GUILD_CATEGORY')
      .sort((a, b) => a.position - b.position);

    const nonCategories = channels
      .filter((c) => c.type !== 'GUILD_CATEGORY')
      .sort((a, b) => a.position - b.position);

    const uncategorized = nonCategories.filter((c) => !c.parentId);
    const result: ChannelSection[] = [];

    if (uncategorized.length > 0) {
      result.push({
        title: 'Channels',
        count: uncategorized.length,
        data: uncategorized,
      });
    }

    for (const cat of categories) {
      const children = nonCategories
        .filter((c) => c.parentId === cat.id)
        .sort((a, b) => a.position - b.position);
      if (children.length > 0) {
        result.push({
          title: cat.name ?? 'Unknown',
          count: children.length,
          data: children,
        });
      }
    }

    return result;
  }, [channels]);

  // -- Handlers -------------------------------------------------------------
  const handleChannelPress = useCallback(
    (channel: Channel) => {
      if (VOICE_TYPES.includes(channel.type)) {
        navigation.navigate('VoiceChannel', { guildId, channelId: channel.id });
        return;
      }
      if (NAVIGABLE_TYPES.includes(channel.type)) {
        navigation.navigate('Channel', { guildId, channelId: channel.id });
      }
    },
    [navigation, guildId],
  );

  // -- Render ---------------------------------------------------------------
  const isLoading = guildLoading || channelsLoading;

  if (isLoading && sections.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChannelRow channel={item} onPress={handleChannelPress} />
        )}
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} count={section.count} />
        )}
        ListHeaderComponent={
          guild?.description ? (
            <View style={styles.descriptionBanner}>
              <Text style={styles.descriptionText}>{guild.description}</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingTop: 100, // space for transparent header
    paddingBottom: spacing['5xl'],
  },

  // Header
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 220,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  headerTitleInfo: {
    flexShrink: 1,
  },
  headerTitleText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  headerSubtitleText: {
    color: colors.text.muted,
    fontSize: fontSize.xs,
  },
  headerAction: {
    padding: spacing.xs,
  },
  headerActionText: {
    fontSize: 18,
  },
  headerChevron: {
    fontSize: 22,
    color: colors.text.muted,
    fontWeight: '300',
    marginLeft: spacing.xs,
  },

  // Description banner
  descriptionBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  descriptionText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text.muted,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  sectionCount: {
    color: colors.text.muted,
    fontSize: fontSize.xs,
  },

  // Channel row
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  channelIcon: {
    width: 28,
    textAlign: 'center',
    fontSize: fontSize.lg,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  channelIconVoice: {
    color: colors.text.muted,
  },
  channelInfo: {
    flex: 1,
  },
  channelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  channelName: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
    fontWeight: '500',
    flexShrink: 1,
  },
  channelNameVoice: {
    color: colors.text.muted,
  },
  channelTopic: {
    color: colors.text.muted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  nsfwBadge: {
    backgroundColor: colors.accent.error,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  nsfwBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },

});
