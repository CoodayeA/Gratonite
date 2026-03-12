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
import type { Channel } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'GuildChannels'>;

interface Section {
  title: string;
  data: Channel[];
}

const CHANNEL_TYPE_COLORS: Record<string, string> = {
  GUILD_TEXT: '#6c63ff',
  GUILD_VOICE: '#22c55e',
  GUILD_ANNOUNCEMENT: '#f59e0b',
  GUILD_FORUM: '#8b5cf6',
};

export default function GuildChannelsScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const glass = useGlass();
  const toast = useToast();
  const { guildId, guildName } = route.params;
  const [channelList, setChannelList] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifChannel, setNotifChannel] = useState<string | null>(null);

  // Add settings button to header
  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('GuildSettings', { guildId, guildName })}
          style={{ marginRight: 8 }}
        >
          <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, guildId, guildName]);

  const fetchChannels = useCallback(async () => {
    try {
      const data = await channelsApi.getForGuild(guildId);
      setChannelList(data ?? []);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error(err.message || 'Failed to load channels');
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
      result.push({ title: 'Channels', data: uncategorized });
    }

    categories.forEach((cat) => {
      const children = channelList
        .filter((c) => c.parentId === cat.id)
        .sort((a, b) => a.position - b.position);
      if (children.length > 0) {
        result.push({ title: (cat.name || 'Untitled').toUpperCase(), data: children });
      }
    });

    return result;
  }, [channelList]);

  const getChannelIcon = (type: string): string => {
    switch (type) {
      case 'GUILD_TEXT': return 'chatbubble-outline';
      case 'GUILD_VOICE': return 'volume-medium-outline';
      case 'GUILD_ANNOUNCEMENT': return 'megaphone-outline';
      case 'GUILD_FORUM': return 'albums-outline';
      default: return 'chatbubble-outline';
    }
  };

  const handleChannelPress = (channel: Channel) => {
    if (channel.type === 'GUILD_VOICE') {
      navigation.navigate('VoiceChannel', {
        channelId: channel.id,
        channelName: channel.name,
        guildId,
      });
    } else {
      navigation.navigate('ChannelChat', {
        channelId: channel.id,
        channelName: channel.name,
        guildId,
      });
    }
  };

  const renderChannel = ({ item }: { item: Channel }) => {
    const typeColor = CHANNEL_TYPE_COLORS[item.type] || colors.textMuted;

    return (
      <TouchableOpacity
        style={styles.channelItem}
        onPress={() => handleChannelPress(item)}
        onLongPress={() => setNotifChannel(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.channelIconWrap, { backgroundColor: typeColor + '15' }]}>
          <Ionicons
            name={getChannelIcon(item.type) as any}
            size={18}
            color={typeColor}
          />
        </View>
        <Text style={styles.channelName} numberOfLines={1}>{item.name}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ opacity: 0.5 }} />
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
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
        renderItem={renderChannel}
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
              <Ionicons name="chatbubble-ellipses-outline" size={64} color={colors.accentPrimary} style={{ opacity: 0.5, transform: [{ rotate: '-3deg' }] }} />
              <Text style={styles.emptyText}>No channels yet</Text>
              <TouchableOpacity onPress={() => { setLoading(true); fetchChannels(); }}>
                <Text style={{ color: colors.accentPrimary, fontSize: fontSize.md, marginTop: spacing.sm }}>Tap to retry</Text>
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
