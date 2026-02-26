import React, { useLayoutEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { PortalsStackParamList } from '../../navigation/types';
import { channelsApi } from '../../lib/api';
import { colors, fontSize, spacing, radius } from '../../theme';

type Nav = NativeStackNavigationProp<PortalsStackParamList, 'GuildChannels'>;
type Route = RouteProp<PortalsStackParamList, 'GuildChannels'>;

interface Channel {
  id: string;
  name: string;
  type: string;
  position: number;
  parentId?: string | null;
  topic?: string | null;
}

interface ChannelSection {
  title: string;
  data: Channel[];
}

const CHANNEL_ICONS: Record<string, string> = {
  GUILD_TEXT: '#',
  GUILD_VOICE: '\uD83D\uDD0A',
  GUILD_ANNOUNCEMENT: '\uD83D\uDCE2',
  GUILD_STAGE_VOICE: '\uD83C\uDFAD',
  GUILD_FORUM: '\uD83D\uDCAC',
};

// ── Main Screen ──────────────────────────────────────────────────────────────

export function GuildChannelsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { guildId } = route.params;
  const queryClient = useQueryClient();

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: channels, isLoading } = useQuery<Channel[]>({
    queryKey: ['guild-channels', guildId],
    queryFn: () => channelsApi.getGuildChannels(guildId),
  });

  const sections: ChannelSection[] = useMemo(() => {
    if (!channels) return [];

    const categories = channels
      .filter((c) => c.type === 'GUILD_CATEGORY')
      .sort((a, b) => a.position - b.position);

    const nonCategories = channels
      .filter((c) => c.type !== 'GUILD_CATEGORY')
      .sort((a, b) => a.position - b.position);

    const uncategorized = nonCategories.filter((c) => !c.parentId);
    const result: ChannelSection[] = [];

    if (uncategorized.length > 0) {
      result.push({ title: 'Channels', data: uncategorized });
    }

    for (const cat of categories) {
      const children = nonCategories
        .filter((c) => c.parentId === cat.id)
        .sort((a, b) => a.position - b.position);
      if (children.length > 0) {
        result.push({ title: cat.name ?? 'Unknown', data: children });
      }
    }

    return result;
  }, [channels]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: { name: string; type: string }) =>
      channelsApi.create(guildId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild-channels', guildId] });
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (channelId: string) => channelsApi.delete(channelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild-channels', guildId] });
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreate = useCallback(() => {
    const doCreate = (name: string, type: string) => {
      if (name.trim()) {
        createMutation.mutate({ name: name.trim(), type });
      }
    };

    const askType = (name: string) => {
      Alert.alert('Channel Type', 'Select a channel type:', [
        { text: 'Text', onPress: () => doCreate(name, 'GUILD_TEXT') },
        { text: 'Voice', onPress: () => doCreate(name, 'GUILD_VOICE') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    };

    if (Platform.OS === 'ios') {
      Alert.prompt('Create Channel', 'Enter a name for the new channel:', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Next',
          onPress: (name?: string) => {
            if (name?.trim()) askType(name.trim());
          },
        },
      ]);
    } else {
      // Android: create with default name
      Alert.alert('Create Channel', 'Select a channel type:', [
        {
          text: 'Text Channel',
          onPress: () => doCreate('new-channel', 'GUILD_TEXT'),
        },
        {
          text: 'Voice Channel',
          onPress: () => doCreate('new-channel', 'GUILD_VOICE'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [createMutation]);

  const handleDelete = useCallback(
    (channel: Channel) => {
      Alert.alert(
        'Delete Channel',
        `Are you sure you want to delete #${channel.name}? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteMutation.mutate(channel.id),
          },
        ],
      );
    },
    [deleteMutation],
  );

  // ── Header ────────────────────────────────────────────────────────────────

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleCreate}
          style={styles.headerBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.headerBtnText}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleCreate]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No channels yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {section.title.toUpperCase()}
            </Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const icon = CHANNEL_ICONS[item.type] ?? '#';
          return (
            <View style={styles.row}>
              <Text style={styles.channelIcon}>{icon}</Text>
              <View style={styles.channelInfo}>
                <Text style={styles.channelName} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.topic ? (
                  <Text style={styles.channelTopic} numberOfLines={1}>
                    {item.topic}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteBtnText}>{'\u00D7'}</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  listContent: {
    paddingBottom: spacing['5xl'],
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.text.muted,
    textAlign: 'center',
  },

  // Header
  headerBtn: {
    padding: spacing.xs,
  },
  headerBtnText: {
    fontSize: 24,
    color: colors.brand.primary,
    fontWeight: '600',
  },

  // Section
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

  // Row
  row: {
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
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
  },
  channelTopic: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginTop: 2,
  },

  // Delete
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent.error + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    color: colors.accent.error,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
});
