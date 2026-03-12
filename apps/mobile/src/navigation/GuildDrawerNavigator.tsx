import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { createDrawerNavigator, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { channels as channelsApi } from '../lib/api';
import { useTheme, useColors } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { selectionFeedback } from '../lib/haptics';
import type { Channel } from '../types';
import ChannelChatScreen from '../screens/guild/ChannelChatScreen';
import VoiceChannelScreen from '../screens/guild/VoiceChannelScreen';

const Drawer = createDrawerNavigator();

// ---------------------------------------------------------------------------
// Flat list item model
// ---------------------------------------------------------------------------

type ListItem =
  | { kind: 'uncategorized-header'; id: string }
  | { kind: 'category'; channel: Channel; collapsed: boolean; id: string }
  | { kind: 'channel'; channel: Channel; id: string };

// ---------------------------------------------------------------------------
// Channel icon helper
// ---------------------------------------------------------------------------

const getIcon = (type: string): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case 'GUILD_TEXT':
      return 'chatbubble-outline';
    case 'GUILD_VOICE':
      return 'volume-medium-outline';
    case 'GUILD_ANNOUNCEMENT':
      return 'megaphone-outline';
    case 'GUILD_FORUM':
      return 'reader-outline';
    case 'GUILD_WIKI':
      return 'book-outline';
    case 'GUILD_TIMELINE':
      return 'time-outline';
    case 'GUILD_QA':
      return 'help-circle-outline';
    case 'GUILD_STAGE':
      return 'mic-outline';
    default:
      return 'chatbubble-outline';
  }
};

// ---------------------------------------------------------------------------
// Custom drawer content
// ---------------------------------------------------------------------------

function CustomDrawerContent(
  props: DrawerContentComponentProps & { guildId: string; guildName: string },
) {
  const insets = useSafeAreaInsets();
  const { colors, spacing, fontSize, borderRadius } = useTheme();

  const [channelList, setChannelList] = useState<Channel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creating, setCreating] = useState(false);

  // ---- Fetch channels ----

  const fetchChannels = useCallback(async () => {
    try {
      const data = await channelsApi.getForGuild(props.guildId);
      setChannelList(data);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }, [props.guildId]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // ---- Navigate to channel ----

  const navigateToChannel = useCallback(
    (item: Channel) => {
      const parentNav = (props.navigation as any).getParent?.();
      switch (item.type) {
        case 'GUILD_TEXT':
          props.navigation.navigate('ChannelChat', {
            channelId: item.id,
            channelName: item.name,
            guildId: props.guildId,
          });
          break;
        case 'GUILD_VOICE':
          props.navigation.navigate('VoiceChannel', {
            channelId: item.id,
            channelName: item.name,
            guildId: props.guildId,
          });
          break;
        case 'GUILD_FORUM':
          parentNav?.navigate('ForumChannel', {
            channelId: item.id,
            channelName: item.name,
          });
          break;
        case 'GUILD_WIKI':
          parentNav?.navigate('WikiChannel', {
            channelId: item.id,
            channelName: item.name,
          });
          break;
        case 'GUILD_ANNOUNCEMENT':
          parentNav?.navigate('AnnouncementChannel', {
            channelId: item.id,
            channelName: item.name,
            guildId: props.guildId,
          });
          break;
        case 'GUILD_TIMELINE':
          parentNav?.navigate('TimelineChannel', {
            channelId: item.id,
            channelName: item.name,
          });
          break;
        case 'GUILD_QA':
          parentNav?.navigate('QAChannel', {
            channelId: item.id,
            channelName: item.name,
          });
          break;
        case 'GUILD_STAGE':
          parentNav?.navigate('StageChannel', {
            channelId: item.id,
            channelName: item.name,
            guildId: props.guildId,
          });
          break;
        default:
          props.navigation.navigate('ChannelChat', {
            channelId: item.id,
            channelName: item.name,
            guildId: props.guildId,
          });
      }
    },
    [props.navigation, props.guildId],
  );

  // ---- Build flat list with category headers ----

  const flatData: ListItem[] = useMemo(() => {
    const categories = channelList
      .filter((c) => c.type === 'GUILD_CATEGORY')
      .sort((a, b) => a.position - b.position);
    const uncategorized = channelList
      .filter((c) => c.type !== 'GUILD_CATEGORY' && !c.parentId)
      .sort((a, b) => a.position - b.position);

    const result: ListItem[] = [];

    if (uncategorized.length > 0) {
      result.push({ kind: 'uncategorized-header', id: 'uncat-header' });
      uncategorized.forEach((ch) => result.push({ kind: 'channel', channel: ch, id: ch.id }));
    }

    categories.forEach((cat) => {
      const isCollapsed = collapsedCategories.has(cat.id);
      result.push({ kind: 'category', channel: cat, collapsed: isCollapsed, id: `cat-${cat.id}` });
      if (!isCollapsed) {
        const children = channelList
          .filter((c) => c.parentId === cat.id)
          .sort((a, b) => a.position - b.position);
        children.forEach((ch) => result.push({ kind: 'channel', channel: ch, id: ch.id }));
      }
    });

    return result;
  }, [channelList, collapsedCategories]);

  // ---- Category collapse toggle ----

  const toggleCategory = useCallback((catId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
    selectionFeedback();
  }, []);

  // ---- Move channel up/down (edit mode reorder) ----

  const moveChannel = useCallback(
    async (channelId: string, direction: 'up' | 'down') => {
      const nonCategoryChannels = channelList.filter((c) => c.type !== 'GUILD_CATEGORY');
      const idx = nonCategoryChannels.findIndex((c) => c.id === channelId);
      if (idx < 0) return;

      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= nonCategoryChannels.length) return;

      const a = nonCategoryChannels[idx];
      const b = nonCategoryChannels[swapIdx];

      // Swap positions
      const updates = [
        { id: a.id, position: b.position, parentId: b.parentId },
        { id: b.id, position: a.position, parentId: a.parentId },
      ];

      setChannelList((prev) =>
        prev.map((ch) => {
          if (ch.id === a.id) return { ...ch, position: b.position, parentId: b.parentId };
          if (ch.id === b.id) return { ...ch, position: a.position, parentId: a.parentId };
          return ch;
        }),
      );

      try {
        await channelsApi.updatePositions(props.guildId, updates);
      } catch {
        fetchChannels();
      }
      selectionFeedback();
    },
    [channelList, props.guildId, fetchChannels],
  );

  // ---- Create category ----

  const handleCreateCategory = useCallback(async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await channelsApi.create(props.guildId, { name, type: 'GUILD_CATEGORY' });
      setNewCategoryName('');
      setShowCreateCategory(false);
      fetchChannels();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create category');
    } finally {
      setCreating(false);
    }
  }, [newCategoryName, props.guildId, fetchChannels]);

  // ---- Styles ----

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bgSecondary },
        header: {
          paddingBottom: spacing.md,
          paddingHorizontal: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: colors.bgElevated,
        },
        headerTitle: {
          color: colors.textPrimary,
          fontSize: fontSize.lg,
          fontWeight: '700',
          flex: 1,
          marginRight: spacing.sm,
        },
        headerBtn: { padding: spacing.xs },
        headerActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        categoryHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          marginTop: spacing.md,
        },
        categoryTitle: {
          color: colors.textMuted,
          fontSize: fontSize.xs,
          fontWeight: '700',
          letterSpacing: 1,
          flex: 1,
          textTransform: 'uppercase',
        },
        chevron: { marginRight: spacing.xs },
        channelItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
        },
        channelName: {
          color: colors.textSecondary,
          fontSize: fontSize.md,
          fontWeight: '500',
          flex: 1,
        },
        moveBtn: {
          padding: 4,
        },
        uncategorizedHeader: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          marginTop: spacing.sm,
        },
        uncategorizedTitle: {
          color: colors.textMuted,
          fontSize: fontSize.xs,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
        },
        createCategoryRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        createInput: {
          flex: 1,
          backgroundColor: colors.inputBg || colors.bgElevated,
          color: colors.textPrimary,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          fontSize: fontSize.sm,
          borderWidth: 1,
          borderColor: colors.border,
        },
        createBtn: {
          backgroundColor: colors.accentPrimary,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
        createBtnText: {
          color: colors.white,
          fontSize: fontSize.sm,
          fontWeight: '600',
        },
        addCategoryBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        addCategoryText: {
          color: colors.accentPrimary,
          fontSize: fontSize.sm,
          fontWeight: '600',
        },
      }),
    [colors, spacing, fontSize, borderRadius],
  );

  // ---- Render list item ----

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === 'uncategorized-header') {
        return (
          <View style={s.uncategorizedHeader}>
            <Text style={s.uncategorizedTitle}>CHANNELS</Text>
          </View>
        );
      }

      if (item.kind === 'category') {
        return (
          <TouchableOpacity
            style={s.categoryHeader}
            onPress={() => toggleCategory(item.channel.id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={item.collapsed ? 'chevron-forward' : 'chevron-down'}
              size={14}
              color={colors.textMuted}
              style={s.chevron}
            />
            <Text style={s.categoryTitle}>{item.channel.name}</Text>
          </TouchableOpacity>
        );
      }

      // Channel item
      return (
        <TouchableOpacity
          style={s.channelItem}
          onPress={() => {
            if (!isEditing) navigateToChannel(item.channel);
          }}
          activeOpacity={isEditing ? 1 : 0.7}
        >
          <Ionicons name={getIcon(item.channel.type)} size={20} color={colors.textMuted} />
          <Text style={s.channelName} numberOfLines={1}>
            {item.channel.name}
          </Text>
          {isEditing && (
            <>
              <TouchableOpacity
                style={s.moveBtn}
                onPress={() => moveChannel(item.channel.id, 'up')}
              >
                <Ionicons name="chevron-up" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.moveBtn}
                onPress={() => moveChannel(item.channel.id, 'down')}
              >
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      );
    },
    [isEditing, colors, s, navigateToChannel, toggleCategory, moveChannel],
  );

  const keyExtractor = useCallback((item: ListItem) => item.id, []);

  // ---- Render ----

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity
          onPress={() => (props.navigation as any).getParent()?.goBack()}
          style={s.headerBtn}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {props.guildName}
        </Text>
        <View style={s.headerActions}>
          <TouchableOpacity
            onPress={() => setIsEditing((e) => !e)}
            style={s.headerBtn}
          >
            <Ionicons
              name={isEditing ? 'checkmark' : 'reorder-three-outline'}
              size={20}
              color={isEditing ? colors.accentPrimary : colors.textPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              (props.navigation as any)
                .getParent()
                ?.navigate('GuildSettings', {
                  guildId: props.guildId,
                  guildName: props.guildName,
                })
            }
            style={s.headerBtn}
          >
            <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Channel list */}
      <FlatList
        data={flatData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchChannels();
            }}
            tintColor={colors.accentPrimary}
          />
        }
      />

      {/* Create Category — visible in edit mode */}
      {isEditing && !showCreateCategory && (
        <TouchableOpacity
          style={s.addCategoryBtn}
          onPress={() => setShowCreateCategory(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.accentPrimary} />
          <Text style={s.addCategoryText}>Create Category</Text>
        </TouchableOpacity>
      )}
      {showCreateCategory && (
        <View style={s.createCategoryRow}>
          <TextInput
            style={s.createInput}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            placeholder="Category name..."
            placeholderTextColor={colors.textMuted}
            autoFocus
            onSubmitEditing={handleCreateCategory}
          />
          <TouchableOpacity
            style={s.createBtn}
            onPress={handleCreateCategory}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={s.createBtnText}>Add</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowCreateCategory(false);
              setNewCategoryName('');
            }}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Landing screen — opens drawer immediately so user sees channels
// ---------------------------------------------------------------------------

function GuildLandingScreen({
  navigation,
  guildId,
}: {
  navigation: any;
  guildId: string;
}) {
  const colors = useColors();

  useEffect(() => {
    // Open the drawer right away so the user sees the channel list
    const timer = setTimeout(() => {
      navigation.openDrawer();
    }, 100);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bgPrimary,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
      }}
    >
      <Ionicons name="list-outline" size={48} color={colors.textMuted} />
      <Text
        style={{
          color: colors.textSecondary,
          marginTop: 16,
          fontSize: 16,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        Select a channel
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          marginTop: 8,
          fontSize: 14,
          textAlign: 'center',
        }}
      >
        Swipe from the left or tap below to see channels
      </Text>
      <TouchableOpacity
        style={{
          marginTop: 24,
          backgroundColor: colors.accentPrimary,
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 8,
        }}
        onPress={() => navigation.openDrawer()}
      >
        <Text style={{ color: colors.white, fontWeight: '600' }}>View Channels</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Drawer navigator
// ---------------------------------------------------------------------------

export default function GuildDrawerNavigator({ route }: any) {
  const { guildId, guildName } = route.params;
  const { colors, spacing } = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={(drawerProps) => (
        <CustomDrawerContent {...drawerProps} guildId={guildId} guildName={guildName} />
      )}
      screenOptions={({ navigation: nav }) => ({
        headerStyle: { backgroundColor: colors.bgSecondary },
        headerTintColor: colors.textPrimary,
        drawerStyle: { backgroundColor: colors.bgSecondary, width: 280 },
        sceneStyle: { backgroundColor: colors.bgPrimary },
        swipeEnabled: true,
        swipeEdgeWidth: 50,
        drawerType: 'slide' as const,
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => nav.openDrawer()}
            style={{ padding: spacing.sm, marginLeft: 4 }}
          >
            <Ionicons name="menu-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity
            onPress={() => (nav as any).getParent()?.navigate('MainTabs')}
            style={{ padding: spacing.sm }}
          >
            <Ionicons name="home-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        ),
      })}
      screenListeners={{
        drawerItemPress: () => selectionFeedback(),
      }}
    >
      <Drawer.Screen
        name="SelectChannel"
        options={{ title: guildName }}
      >
        {({ navigation: screenNav }) => (
          <GuildLandingScreen navigation={screenNav} guildId={guildId} />
        )}
      </Drawer.Screen>
      <Drawer.Screen
        name="ChannelChat"
        component={ChannelChatScreen}
        options={({ route: r }: any) => ({
          title: `#${r.params?.channelName || 'channel'}`,
        })}
      />
      <Drawer.Screen
        name="VoiceChannel"
        component={VoiceChannelScreen}
        options={({ route: r }: any) => ({
          title: r.params?.channelName || 'Voice',
        })}
      />
    </Drawer.Navigator>
  );
}
