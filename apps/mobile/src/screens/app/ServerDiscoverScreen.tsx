import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { guilds as guildsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme, useGlass } from '../../lib/theme';
import { formatMemberCount } from '../../lib/formatters';
import SearchBar from '../../components/SearchBar';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import Avatar from '../../components/Avatar';
import type { Guild } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'ServerDiscover'>;

export default function ServerDiscoverScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const glass = useGlass();
  const toast = useToast();
  const [allGuilds, setAllGuilds] = useState<Guild[]>([]);
  const [filtered, setFiltered] = useState<Guild[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const fetchGuilds = useCallback(async () => {
    try {
      const data = await guildsApi.discover();
      setAllGuilds(data);
      setFiltered(data);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load portals');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGuilds();
  }, [fetchGuilds]);

  useEffect(() => {
    if (!query.trim()) {
      setFiltered(allGuilds);
    } else {
      const q = query.toLowerCase();
      setFiltered(
        allGuilds.filter(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            (g.description && g.description.toLowerCase().includes(q)),
        ),
      );
    }
  }, [query, allGuilds]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGuilds();
  };

  const handleJoin = async (guild: Guild) => {
    setJoiningId(guild.id);
    try {
      await guildsApi.join(guild.id);
      navigation.navigate('GuildChannels', { guildId: guild.id, guildName: guild.name });
    } catch (err: any) {
      toast.error(err.message || 'Failed to join portal');
    } finally {
      setJoiningId(null);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    list: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    guildCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.md,
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: glass.glassBorder,
        shadowColor: colors.accentPrimary,
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
      } : neo ? {
        backgroundColor: colors.bgElevated,
        borderRadius: 0,
        borderWidth: 2,
        borderColor: colors.border,
      } : {
        backgroundColor: colors.bgElevated,
        borderRadius: borderRadius.lg,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 3,
      }),
    },
    guildIcon: {
      width: 48,
      height: 48,
      borderRadius: neo ? 0 : glass ? borderRadius.lg : borderRadius.lg,
      backgroundColor: glass ? 'transparent' : colors.bgHover,
      justifyContent: 'center',
      alignItems: 'center',
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    guildIconText: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: neo ? '700' : '600',
    },
    guildInfo: {
      flex: 1,
    },
    guildName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: neo ? '700' : '600',
      marginBottom: 2,
    },
    guildDescription: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 18,
      marginBottom: spacing.xs,
    },
    guildMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    memberCount: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    joinButton: {
      backgroundColor: colors.accentPrimary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: neo ? 0 : glass ? borderRadius.xl : borderRadius.md,
      minWidth: 60,
      alignItems: 'center',
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
      ...(glass ? {
        shadowColor: colors.accentPrimary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      } : {}),
    },
    joinButtonDisabled: {
      opacity: 0.6,
    },
    joinButtonText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: neo ? '700' : '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo, glass]);

  const renderGuild = ({ item }: { item: Guild }) => (
    <View style={styles.guildCard}>
      <View style={styles.guildIcon}>
        {item.iconHash ? (
          <Avatar userId={item.id} avatarHash={item.iconHash} name={item.name} size={48} />
        ) : (
          <Text style={styles.guildIconText}>{item.name.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.guildInfo}>
        <Text style={styles.guildName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.description && (
          <Text style={styles.guildDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.guildMeta}>
          <Ionicons name="people-outline" size={14} color={colors.textMuted} />
          <Text style={styles.memberCount}>{formatMemberCount(item.memberCount)} members</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.joinButton, joiningId === item.id && styles.joinButtonDisabled]}
        onPress={() => handleJoin(item)}
        disabled={joiningId === item.id}
      >
        {joiningId === item.id ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={styles.joinButtonText}>Join</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <PatternBackground>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search public portals..."
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderGuild}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          query.trim() ? (
            <EmptyState
              icon="search-outline"
              title="No portals found"
              subtitle={`No portals matching "${query}"`}
            />
          ) : (
            <EmptyState
              icon="compass-outline"
              title="No public portals"
              subtitle="There are no public portals to discover right now"
            />
          )
        }
      />
    </PatternBackground>
  );
}
