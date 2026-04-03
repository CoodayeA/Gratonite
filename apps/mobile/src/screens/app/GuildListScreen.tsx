import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useAppState } from '../../contexts/AppStateContext';
import { guilds as guildsApi, users as usersApi } from '../../lib/api';
import Avatar from '../../components/Avatar';
import StatusPicker from '../../components/StatusPicker';
import { useChannelUnread } from '../../lib/unreadStore';
import { useTheme, useNeo, useGlass } from '../../lib/theme';
import { notificationSuccess } from '../../lib/haptics';
import type { Guild, PresenceStatus } from '../../types';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppTabParamList, AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';
import PressableScale from '../../components/PressableScale';
import AnimatedListItem from '../../components/AnimatedListItem';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Guilds'>,
  NativeStackScreenProps<AppStackParamList>
>;

const NEO_PALETTE_KEYS = ['coral', 'mint', 'butter', 'lavender', 'sky', 'peach'] as const;

export default function GuildListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { guilds, refreshGuilds } = useAppState();
  const [refreshing, setRefreshing] = useState(false);
  const [statusPickerVisible, setStatusPickerVisible] = useState(false);
  const [onlineCounts, setOnlineCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(false);
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const neo = useNeo();
  const glass = useGlass();

  // Fetch online member counts with 30s TTL cache
  const hasFetchedCounts = useRef(false);
  const lastFetchTime = useRef(0);
  const FETCH_COOLDOWN_MS = 30_000;
  const fetchOnlineCounts = useCallback(async (guildList: Guild[], force = false) => {
    if (guildList.length === 0) return;
    const now = Date.now();
    if (!force && now - lastFetchTime.current < FETCH_COOLDOWN_MS) return;
    lastFetchTime.current = now;
    setLoadingCounts(true);
    try {
      // Fetch members for up to 10 guilds at a time to limit concurrent requests
      const BATCH_SIZE = 10;
      const membersByGuild: Array<{ guildId: string; userIds: string[] }> = [];
      for (let i = 0; i < guildList.length; i += BATCH_SIZE) {
        const batch = guildList.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (g) => {
            try {
              const members = await guildsApi.getMembers(g.id);
              return { guildId: g.id, userIds: members.map((m) => m.userId) };
            } catch {
              return { guildId: g.id, userIds: [] as string[] };
            }
          }),
        );
        membersByGuild.push(...results);
      }

      // Collect all unique user IDs
      const allIds = new Set<string>();
      for (const g of membersByGuild) {
        for (const id of g.userIds) allIds.add(id);
      }
      if (allIds.size === 0) return;

      // Batch query presences (API caps at 200 per call)
      const idArray = Array.from(allIds);
      const presenceMap = new Map<string, string>();
      for (let i = 0; i < idArray.length; i += 200) {
        const batch = idArray.slice(i, i + 200);
        try {
          const presences = await usersApi.getPresences(batch);
          for (const p of presences) presenceMap.set(p.userId, p.status);
        } catch {
          // best-effort
        }
      }

      // Compute per-guild online counts
      const counts: Record<string, number> = {};
      for (const g of membersByGuild) {
        counts[g.guildId] = g.userIds.filter((id) => {
          const status = presenceMap.get(id);
          return status === 'online' || status === 'idle' || status === 'dnd';
        }).length;
      }
      setOnlineCounts(counts);
    } catch {
      // ignore
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    if (hasFetchedCounts.current || guilds.length === 0) return;
    hasFetchedCounts.current = true;
    fetchOnlineCounts(guilds);
  }, [guilds, fetchOnlineCounts]);

  // Re-fetch online counts on focus, respecting TTL
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (guilds.length > 0) {
        fetchOnlineCounts(guilds);
      }
    });
    return unsubscribe;
  }, [navigation, guilds, fetchOnlineCounts]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    headerTitleWrap: {
      flexDirection: 'column',
    },
    headerTitle: {
      fontSize: fontSize.xxl,
      fontWeight: neo !== null ? '900' : glass ? '600' : '800',
      color: colors.accentPrimary,
      textTransform: neo !== null ? 'uppercase' : 'uppercase',
      letterSpacing: neo !== null ? 2 : 1.5,
    },
    headerUnderline: {
      height: glass ? 2 : 3,
      width: 40,
      backgroundColor: colors.accentPrimary,
      borderRadius: 2,
      marginTop: 4,
      opacity: glass ? 0.6 : 1,
    },
    headerActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    headerBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: glass.glassBorder,
      } : neo !== null ? {
        backgroundColor: neo.palette[NEO_PALETTE_KEYS[3]],
        borderRadius: 0,
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
      } : {
        backgroundColor: colors.bgSecondary,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
      }),
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    userStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
      gap: 5,
    },
    statusGlow: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    userStatusText: {
      fontSize: fontSize.xs,
    },
    list: {
      paddingTop: spacing.sm,
      paddingBottom: Math.max(insets.bottom, spacing.xxl),
    },
    guildItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: glass.glassBorder,
        shadowColor: colors.accentPrimary,
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
      } : neo !== null ? {
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
        borderRadius: 0,
        shadowColor: neo.shadowColor,
        shadowOpacity: neo.shadowOpacity,
        shadowOffset: neo.shadowOffset,
        shadowRadius: neo.shadowRadius,
      } : {
        backgroundColor: colors.bgElevated,
        borderRadius: borderRadius.xl,
        shadowColor: colors.black,
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 8,
        elevation: 4,
      }),
    },
    guildAccentStrip: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: colors.accentPrimary,
      borderTopLeftRadius: neo !== null ? 0 : borderRadius.xl,
      borderBottomLeftRadius: neo !== null ? 0 : borderRadius.xl,
    },
    guildIcon: {
      width: 56,
      height: 56,
      borderRadius: neo !== null ? 0 : borderRadius.xl,
      backgroundColor: glass ? 'transparent' : colors.bgHover,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    guildIconText: {
      color: colors.textPrimary,
      fontSize: fontSize.xxl,
      fontWeight: '700',
    },
    guildInfo: {
      flex: 1,
      marginLeft: spacing.md,
    },
    guildName: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '700',
    },
    guildMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 3,
      gap: 4,
    },
    guildMetaText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
    onlineDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginLeft: 4,
    },
    chevron: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    empty: {
      alignItems: 'center',
      paddingTop: 100,
      gap: spacing.lg,
    },
    emptyIconWrap: {
      transform: [{ rotate: '-8deg' }],
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: fontSize.xl,
      fontWeight: '700',
    },
    emptySubtext: {
      color: colors.textMuted,
      fontSize: fontSize.md,
      textAlign: 'center',
      paddingHorizontal: spacing.xxxl,
    },
  }), [colors, neo, glass, spacing, fontSize, borderRadius, insets.bottom]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshGuilds();
    try {
      const freshGuilds = await guildsApi.getMine();
      fetchOnlineCounts(freshGuilds, true);
    } catch {
      fetchOnlineCounts(guilds, true);
    }
    setRefreshing(false);
    notificationSuccess();
  }, [refreshGuilds, guilds, fetchOnlineCounts]);

  const getStatusColor = (status?: PresenceStatus): string => {
    switch (status) {
      case 'online': return colors.online;
      case 'idle': return colors.idle;
      case 'dnd': return colors.dnd;
      case 'invisible': return colors.offline;
      default: return colors.offline;
    }
  };

  const renderGuild = ({ item, index }: { item: Guild; index: number }) => {
    const neoItemStyle = neo !== null
      ? {
          backgroundColor: neo.palette[NEO_PALETTE_KEYS[index % 6]],
        }
      : undefined;

    const accentColor = neo !== null
      ? neo.palette[NEO_PALETTE_KEYS[(index + 2) % 6]]
      : colors.accentPrimary;

    return (
      <AnimatedListItem index={index}>
        <PressableScale
          style={[styles.guildItem, neoItemStyle]}
          onPress={() => navigation.navigate('GuildChannels', { guildId: item.id, guildName: item.name })}
        >
          <View style={[styles.guildAccentStrip, { backgroundColor: accentColor }]} />
          <View style={styles.guildIcon}>
            {item.iconHash ? (
              <Avatar userId={item.id} avatarHash={item.iconHash} name={item.name} size={56} />
            ) : (
              <Text style={styles.guildIconText}>{item.name.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.guildInfo}>
            <Text style={styles.guildName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.guildMetaRow}>
              <Text style={styles.guildMetaText}>
                {item.memberCount ?? 0} member{(item.memberCount ?? 0) !== 1 ? 's' : ''}
              </Text>
              {onlineCounts[item.id] != null ? (
                <>
                  <Text style={styles.guildMetaText}>{' \u00B7 '}</Text>
                  <View style={[styles.onlineDot, { backgroundColor: colors.online }]} />
                  <Text style={[styles.guildMetaText, { color: colors.online }]}>
                    {onlineCounts[item.id]} online
                  </Text>
                </>
              ) : loadingCounts ? (
                <>
                  <Text style={styles.guildMetaText}>{' \u00B7 '}</Text>
                  <Text style={styles.guildMetaText}>\u2026</Text>
                </>
              ) : null}
            </View>
          </View>
          <View style={styles.chevron}>
            <Ionicons name="chevron-forward" size={16} color={colors.accentPrimary} />
          </View>
        </PressableScale>
      </AnimatedListItem>
    );
  };

  const statusColor = getStatusColor(user?.status);

  return (
    <PatternBackground>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Portals</Text>
          <View style={styles.headerUnderline} />
        </View>
        <View style={styles.headerActions}>
          <PressableScale onPress={() => navigation.navigate('CommandPalette')} style={styles.headerBtn} accessibilityLabel="Search">
            <Ionicons name="search-outline" size={20} color={colors.accentPrimary} />
          </PressableScale>
          <PressableScale onPress={() => navigation.navigate('ServerDiscover')} style={styles.headerBtn} accessibilityLabel="Discover servers">
            <Ionicons name="compass-outline" size={20} color={colors.accentPrimary} />
          </PressableScale>
          <PressableScale onPress={() => navigation.navigate('CreateGuild')} style={styles.headerBtn} accessibilityLabel="Create server">
            <Ionicons name="add-circle-outline" size={20} color={colors.accentPrimary} />
          </PressableScale>
        </View>
      </View>

      {/* User info bar */}
      <PressableScale style={styles.userBar} onPress={() => setStatusPickerVisible(true)}>
        <Avatar
          userId={user?.id}
          avatarHash={user?.avatarHash}
          name={user?.displayName || user?.username || '?'}
          size={42}
          showStatus
          statusOverride={user?.status}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.displayName || user?.username}</Text>
          <View style={styles.userStatusRow}>
            <View style={[styles.statusGlow, { backgroundColor: statusColor, shadowColor: statusColor, shadowOpacity: 0.7, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }]} />
            <Text style={[styles.userStatusText, { color: statusColor }]}>
              {user?.customStatus || formatStatus(user?.status)}
            </Text>
          </View>
        </View>
        <PressableScale onPress={() => navigation.navigate('Settings')} accessibilityLabel="Settings" style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
        </PressableScale>
      </PressableScale>

      <FlatList
        data={guilds}
        keyExtractor={(item) => item.id}
        renderItem={renderGuild}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="planet-outline" size={64} color={colors.accentPrimary} />
            </View>
            <Text style={styles.emptyText}>No servers yet</Text>
            <Text style={styles.emptySubtext}>Create or join a server to get started — your universe awaits!</Text>
          </View>
        }
      />

      <StatusPicker
        visible={statusPickerVisible}
        onClose={() => setStatusPickerVisible(false)}
        currentStatus={user?.status ?? 'offline'}
      />
    </View>
    </PatternBackground>
  );
}

function formatStatus(status?: PresenceStatus): string {
  switch (status) {
    case 'online': return 'Online';
    case 'idle': return 'Idle';
    case 'dnd': return 'Do Not Disturb';
    case 'invisible': return 'Invisible';
    default: return 'Offline';
  }
}
