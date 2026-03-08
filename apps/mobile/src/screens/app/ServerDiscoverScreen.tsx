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
import { useTheme } from '../../lib/theme';
import { formatMemberCount } from '../../lib/formatters';
import SearchBar from '../../components/SearchBar';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { Guild } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ServerDiscover'>;

export default function ServerDiscoverScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
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
        toast.error('Failed to load servers');
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
      toast.error(err.message || 'Failed to join server');
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
      backgroundColor: colors.bgElevated,
      borderRadius: neo ? 0 : borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.md,
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    guildIcon: {
      width: 48,
      height: 48,
      borderRadius: neo ? 0 : borderRadius.lg,
      backgroundColor: colors.bgHover,
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
      borderRadius: neo ? 0 : borderRadius.md,
      minWidth: 60,
      alignItems: 'center',
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    joinButtonDisabled: {
      opacity: 0.6,
    },
    joinButtonText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: neo ? '700' : '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderGuild = ({ item }: { item: Guild }) => (
    <View style={styles.guildCard}>
      <View style={styles.guildIcon}>
        <Text style={styles.guildIconText}>{item.name.charAt(0).toUpperCase()}</Text>
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
    <View style={styles.container}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search public servers..."
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
              title="No servers found"
              subtitle={`No servers matching "${query}"`}
            />
          ) : (
            <EmptyState
              icon="compass-outline"
              title="No public servers"
              subtitle="There are no public servers to discover right now"
            />
          )
        }
      />
    </View>
  );
}
