import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { guilds as guildsApi } from '../../lib/api';
import { colors, spacing, fontSize, borderRadius } from '../../lib/theme';
import type { Guild } from '../../types';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppTabParamList, AppStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Guilds'>,
  NativeStackScreenProps<AppStackParamList>
>;

export default function GuildListScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const [guildList, setGuildList] = useState<Guild[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchGuilds = useCallback(async () => {
    try {
      const data = await guildsApi.getMine();
      setGuildList(data);
    } catch (err: any) {
      if (err.status !== 401) {
        Alert.alert('Error', 'Failed to load servers');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGuilds();
  }, [fetchGuilds]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGuilds();
  };

  const renderGuild = ({ item }: { item: Guild }) => (
    <TouchableOpacity
      style={styles.guildItem}
      onPress={() => navigation.navigate('GuildChannels', { guildId: item.id, guildName: item.name })}
    >
      <View style={styles.guildIcon}>
        <Text style={styles.guildIconText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Servers</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateGuild')}>
          <Ionicons name="add-circle-outline" size={28} color={colors.accentPrimary} />
        </TouchableOpacity>
      </View>

      {/* User info bar */}
      <View style={styles.userBar}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>
            {(user?.displayName || user?.username || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.displayName || user?.username}</Text>
          <Text style={styles.userStatus}>Online</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Ionicons name="log-out-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={guildList}
        keyExtractor={(item) => item.id}
        renderItem={renderGuild}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="planet-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No servers yet</Text>
              <Text style={styles.emptySubtext}>Create or join a server to get started</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  userBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  userStatus: {
    color: colors.online,
    fontSize: fontSize.xs,
  },
  list: {
    paddingTop: spacing.sm,
  },
  guildItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  guildIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
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
});
