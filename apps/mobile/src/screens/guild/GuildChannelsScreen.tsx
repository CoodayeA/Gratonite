import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { channels as channelsApi } from '../../lib/api';
import ChannelNotificationSheet from '../../components/ChannelNotificationSheet';
import { useToast } from '../../contexts/ToastContext';
import { useTheme, useGlass } from '../../lib/theme';
import { useChannelUnread } from '../../lib/unreadStore';
import type { Channel } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'GuildChannels'>;

interface Section {
  id: string;
  title: string;
  data: Channel[];
  collapsible?: boolean;
}

const CHANNEL_TYPE_COLORS: Record<string, string> = {
  GUILD_TEXT: '#6c63ff',
  GUILD_VOICE: '#22c55e',
  GUILD_ANNOUNCEMENT: '#f59e0b',
  GUILD_FORUM: '#8b5cf6',
  GUILD_STAGE: '#ec4899',
};

function ChannelRow({
  channel,
  onPress,
  onLongPress,
  styles,
  colors,
}: {
  channel: Channel;
  onPress: () => void;
  onLongPress: () => void;
  styles: any;
  colors: any;
}) {
  const unread = useChannelUnread(channel.id);
  const typeColor = CHANNEL_TYPE_COLORS[channel.type] || colors.textMuted;

  return (
    <TouchableOpacity
      style={styles.channelItem}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={[styles.channelIconWrap, { backgroundColor: typeColor + '15' }]}>
        <Ionicons
          name={(channel.type === 'GUILD_STAGE' ? 'mic-outline' : channel.type === 'GUILD_FORUM' ? 'albums-outline' : channel.type === 'GUILD_ANNOUNCEMENT' ? 'megaphone-outline' : channel.type === 'GUILD_VOICE' ? 'volume-medium-outline' : 'chatbubble-outline') as any}
          size={18}
          color={typeColor}
        />
      </View>
      <Text style={styles.channelName} numberOfLines={1}>{channel.name}</Text>
      {unread.count > 0 ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>{unread.count > 99 ? '99+' : unread.count}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ opacity: 0.5 }} />
    </TouchableOpacity>
  );
}

export default function GuildChannelsScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const glass = useGlass();
  const toast = useToast();
  const { guildId, guildName } = route.params;
  const [channelList, setChannelList] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifChannel, setNotifChannel] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<string>>(new Set());

  // Add settings button to header
  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('GuildSettings', { guildId, guildName })}
          style={{ marginRight: 8 }}
          accessibilityLabel="Guild settings"
        >
          <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, guildId, guildName]);

  const fetchChannels = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await channelsApi.getForGuild(guildId);
      setChannelList(data ?? []);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err.message || 'Failed to load channels';
        setLoadError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Group channels by category
  const sections: Section[] = React.useMemo(() => {
    const categories = channelList.filter((c) => c.type === 'GUILD_CATEGORY');
    const uncategorized = channelList.filter(
      (c) => c.type !== 'GUILD_CATEGORY' && !c.parentId
    );

    const result: Section[] = [];

    if (uncategorized.length > 0) {
      result.push({ id: 'uncategorized', title: 'Channels', data: uncategorized, collapsible: false });
    }

    categories.forEach((cat) => {
      const children = channelList
        .filter((c) => c.parentId === cat.id)
        .sort((a, b) => a.position - b.position);
      if (children.length > 0) {
        result.push({
          id: cat.id,
          title: (cat.name || 'Untitled').toUpperCase(),
          data: collapsedSectionIds.has(cat.id) ? [] : children,
          collapsible: true,
        });
      }
    });

    return result;
  }, [channelList, collapsedSectionIds]);

  const handleChannelPress = (channel: Channel) => {
    switch (channel.type) {
      case 'GUILD_VOICE':
        navigation.navigate('VoiceChannel', {
          channelId: channel.id,
          channelName: channel.name,
          guildId,
        });
        return;
      case 'GUILD_ANNOUNCEMENT':
        navigation.navigate('AnnouncementChannel', {
          channelId: channel.id,
          channelName: channel.name,
          guildId,
        });
        return;
      case 'GUILD_FORUM':
        navigation.navigate('ForumChannel', {
          channelId: channel.id,
          channelName: channel.name,
        });
        return;
      case 'GUILD_STAGE':
        navigation.navigate('StageChannel', {
          channelId: channel.id,
          channelName: channel.name,
          guildId,
        });
        return;
      default:
        navigation.navigate('ChannelChat', {
          channelId: channel.id,
          channelName: channel.name,
          guildId,
        });
    }
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <TouchableOpacity
      style={styles.sectionHeader}
      activeOpacity={section.collapsible ? 0.7 : 1}
      onPress={() => {
        if (!section.collapsible) return;
        setCollapsedSectionIds((prev) => {
          const next = new Set(prev);
          if (next.has(section.id)) next.delete(section.id);
          else next.add(section.id);
          return next;
        });
      }}
    >
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.collapsible ? (
        <Ionicons
          name={collapsedSectionIds.has(section.id) ? 'chevron-forward' : 'chevron-down'}
          size={14}
          color={colors.textMuted}
        />
      ) : null}
    </TouchableOpacity>
  );

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    list: {
      paddingBottom: spacing.xxxl,
      paddingTop: spacing.sm,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
    },
    sectionAccent: {
      width: 3,
      height: 14,
      borderRadius: 2,
      backgroundColor: colors.accentPrimary,
    },
    sectionTitle: {
      fontSize: fontSize.xs,
      fontWeight: neo ? '800' : '700',
      color: colors.textMuted,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    channelItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      marginHorizontal: spacing.md,
      marginBottom: spacing.xs,
      gap: spacing.md,
      borderRadius: neo ? 0 : borderRadius.md,
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderWidth: 1,
        borderColor: glass.glassBorder,
        borderRadius: borderRadius.md,
      } : {}),
      ...(neo ? {
        borderWidth: 2,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
      } : {}),
    },
    channelIconWrap: {
      width: 32,
      height: 32,
      borderRadius: neo ? 0 : 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    channelName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: neo ? '700' : '500',
      flex: 1,
      ...(neo ? { textTransform: 'uppercase' as const, letterSpacing: 0.3 } : {}),
    },
    unreadBadge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: spacing.xs,
      borderRadius: neo ? 0 : 11,
      backgroundColor: colors.accentPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      ...(neo ? {
        borderWidth: 2,
        borderColor: colors.border,
      } : {}),
    },
    unreadBadgeText: {
      color: colors.white,
      fontSize: fontSize.xs,
      fontWeight: '700',
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
  }), [colors, spacing, fontSize, borderRadius, neo, glass]);

  return (
    <PatternBackground>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChannelRow
            channel={item}
            onPress={() => handleChannelPress(item)}
            onLongPress={() => setNotifChannel(item.id)}
            styles={styles}
            colors={colors}
          />
        )}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchChannels(); }} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={colors.accentPrimary} />
              <Text style={styles.emptyText}>Loading channels…</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons
                name={loadError ? 'alert-circle-outline' : 'chatbubble-ellipses-outline'}
                size={64}
                color={colors.accentPrimary}
                style={{ opacity: 0.5, transform: [{ rotate: '-3deg' }] }}
              />
              <Text style={styles.emptyText}>{loadError ? loadError : 'No channels yet'}</Text>
              <TouchableOpacity onPress={() => { setLoading(true); fetchChannels(); }}>
                <Text style={{ color: colors.accentPrimary, fontSize: fontSize.md, marginTop: spacing.sm }}>
                  {loadError ? 'Retry' : 'Tap to retry'}
                </Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
      <ChannelNotificationSheet
        visible={!!notifChannel}
        onClose={() => setNotifChannel(null)}
        channelId={notifChannel || ''}
      />
    </PatternBackground>
  );
}
