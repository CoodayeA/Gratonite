import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bans as bansApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { GuildBan } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'GuildBans'>;

export default function GuildBansScreen({ route }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const toast = useToast();
  const [banList, setBanList] = useState<GuildBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchBans = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await bansApi.list(guildId);
      setBanList(data);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err.message || 'Failed to load bans';
        setLoadError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, [guildId, toast]);

  useEffect(() => {
    fetchBans();
  }, [fetchBans]);

  const handleUnban = (ban: GuildBan) => {
    const username = ban.user?.username ?? ban.userId.slice(0, 8);
    Alert.alert(
      'Unban User',
      `Are you sure you want to unban ${username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unban',
          style: 'destructive',
          onPress: async () => {
            try {
              await bansApi.unban(guildId, ban.userId);
              setBanList((prev) => prev.filter((b) => b.userId !== ban.userId));
              toast.success(`${username} has been unbanned`);
            } catch (err: any) {
              toast.error(err.message || 'Failed to unban user');
            }
          },
        },
      ],
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerCount: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    listContent: {
      paddingBottom: spacing.xxxl,
    },
    banRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.error + '33',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: colors.error,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    banInfo: {
      flex: 1,
    },
    username: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    reason: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: 2,
    },
    date: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
    unbanBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.error + '22',
      borderRadius: borderRadius.md,
    },
    unbanText: {
      color: colors.error,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
  }), [colors, spacing, fontSize, borderRadius]);

  const renderBan = ({ item }: { item: GuildBan }) => {
    const username = item.user?.username ?? item.userId.slice(0, 8);
    const initial = (item.user?.displayName ?? username).charAt(0).toUpperCase();

    return (
      <View style={styles.banRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.banInfo}>
          <Text style={styles.username} numberOfLines={1}>{username}</Text>
          {item.reason ? (
            <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text>
          ) : null}
          <Text style={styles.date}>
            {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity style={styles.unbanBtn} onPress={() => handleUnban(item)}>
          <Text style={styles.unbanText}>Unban</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) return <LoadingScreen />;

  if (loadError && banList.length === 0) {
    return (
      <PatternBackground>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.md }]}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.accentPrimary} />
          <Text style={[styles.username, { fontSize: fontSize.xl, textAlign: 'center' }]}>Failed to load bans</Text>
          <Text style={[styles.reason, { textAlign: 'center', marginTop: 0 }]}>{loadError}</Text>
          <TouchableOpacity style={styles.unbanBtn} onPress={() => {
            setLoading(true);
            fetchBans();
          }}>
            <Text style={styles.unbanText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </PatternBackground>
    );
  }

  return (
    <PatternBackground>
      <View style={styles.header}>
        <Text style={styles.headerCount}>{banList.length} ban{banList.length !== 1 ? 's' : ''}</Text>
      </View>
      <FlatList
        data={banList}
        keyExtractor={(item) => item.userId}
        renderItem={renderBan}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="ban-outline"
            title="No banned users"
            subtitle="Banned users will appear here"
          />
        }
      />
    </PatternBackground>
  );
}
