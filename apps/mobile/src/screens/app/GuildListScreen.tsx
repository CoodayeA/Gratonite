import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useAppState } from '../../contexts/AppStateContext';
import Avatar from '../../components/Avatar';
import StatusPicker from '../../components/StatusPicker';
import { useChannelUnread } from '../../lib/unreadStore';
import { useTheme, useNeo } from '../../lib/theme';
import type { Guild, PresenceStatus } from '../../types';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppTabParamList, AppStackParamList } from '../../navigation/types';

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
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const neo = useNeo();

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
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
    },
    headerTitle: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    headerBtn: {
      padding: spacing.xs,
    },
    userBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.bgSecondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    userStatus: {
      fontSize: fontSize.xs,
      marginTop: 1,
    },
    list: {
      paddingTop: spacing.sm,
    },
    guildItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      ...(neo !== null ? {
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
      } : {}),
    },
    guildIcon: {
      width: 48,
      height: 48,
      borderRadius: neo !== null ? 0 : borderRadius.lg,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    guildIconText: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: '600',
    },
    guildInfo: {
      flex: 1,
      marginLeft: spacing.md,
    },
    guildName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    guildMeta: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: 2,
    },
    empty: {
      alignItems: 'center',
      paddingTop: 80,
      gap: spacing.md,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: fontSize.lg,
      fontWeight: '600',
    },
    emptySubtext: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
  }), [colors, neo, spacing, fontSize, borderRadius]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshGuilds();
    setRefreshing(false);
  }, [refreshGuilds]);

  const getStatusColor = (status?: PresenceStatus): string => {
    switch (status) {
      case 'online': return colors.online;
      case 'idle': return colors.idle;
      case 'dnd': return colors.dnd;
      case 'invisible': return colors.offline;
      default: return colors.online;
    }
  };

  const renderGuild = ({ item, index }: { item: Guild; index: number }) => {
    const neoItemStyle = neo !== null
      ? { backgroundColor: neo.palette[NEO_PALETTE_KEYS[index % 6]] }
      : undefined;

    return (
      <TouchableOpacity
        style={[styles.guildItem, neoItemStyle]}
        onPress={() => navigation.navigate('GuildDrawer', { guildId: item.id, guildName: item.name })}
      >
        <View style={styles.guildIcon}>
          {item.iconHash ? (
            <Avatar userId={item.id} avatarHash={item.iconHash} name={item.name} size={48} />
          ) : (
            <Text style={styles.guildIconText}>{item.name.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.guildInfo}>
          <Text style={styles.guildName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.guildMeta}>
            {item.memberCount} member{item.memberCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Servers</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('ServerDiscover')} style={styles.headerBtn}>
            <Ionicons name="compass-outline" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('CreateGuild')} style={styles.headerBtn}>
            <Ionicons name="add-circle-outline" size={26} color={colors.accentPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* User info bar */}
      <TouchableOpacity style={styles.userBar} onPress={() => setStatusPickerVisible(true)}>
        <Avatar
          userId={user?.id}
          avatarHash={user?.avatarHash}
          name={user?.displayName || user?.username || '?'}
          size={36}
          showStatus
          statusOverride={user?.status}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.displayName || user?.username}</Text>
          <Text style={[styles.userStatus, { color: getStatusColor(user?.status) }]}>
            {user?.customStatus || formatStatus(user?.status)}
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>

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
            <Ionicons name="planet-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No servers yet</Text>
            <Text style={styles.emptySubtext}>Create or join a server to get started</Text>
          </View>
        }
      />

      <StatusPicker
        visible={statusPickerVisible}
        onClose={() => setStatusPickerVisible(false)}
        currentStatus={user?.status ?? 'online'}
      />
    </View>
  );
}

function formatStatus(status?: PresenceStatus): string {
  switch (status) {
    case 'online': return 'Online';
    case 'idle': return 'Idle';
    case 'dnd': return 'Do Not Disturb';
    case 'invisible': return 'Invisible';
    default: return 'Online';
  }
}
