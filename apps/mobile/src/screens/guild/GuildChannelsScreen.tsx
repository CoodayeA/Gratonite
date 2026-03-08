import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { channels as channelsApi } from '../../lib/api';
import ChannelNotificationSheet from '../../components/ChannelNotificationSheet';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import type { Channel } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'GuildChannels'>;

interface Section {
  title: string;
  data: Channel[];
}

export default function GuildChannelsScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId, guildName } = route.params;
  const [channelList, setChannelList] = useState<Channel[]>([]);
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
      setChannelList(data);
    } catch (err: any) {
      toast.error('Failed to load channels');
    } finally {
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
        result.push({ title: cat.name.toUpperCase(), data: children });
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

  const renderChannel = ({ item }: { item: Channel }) => (
    <TouchableOpacity
      style={styles.channelItem}
      onPress={() => handleChannelPress(item)}
      onLongPress={() => setNotifChannel(item.id)}
    >
      <Ionicons
        name={getChannelIcon(item.type) as any}
        size={20}
        color={colors.textMuted}
      />
      <Text style={styles.channelName} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
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
    },
    sectionHeader: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    sectionTitle: {
      fontSize: fontSize.xs,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
    },
    channelItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    channelName: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontWeight: '500',
      flex: 1,
    },
    empty: {
      alignItems: 'center',
      paddingTop: 80,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.md,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <View style={styles.container}>
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
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No channels</Text>
          </View>
        }
      />
      <ChannelNotificationSheet
        visible={!!notifChannel}
        onClose={() => setNotifChannel(null)}
        channelId={notifChannel || ''}
      />
    </View>
  );
}
