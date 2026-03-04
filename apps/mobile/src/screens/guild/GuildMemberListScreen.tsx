import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { guilds as guildsApi, users as usersApi } from '../../lib/api';
import { colors, spacing, fontSize, borderRadius } from '../../lib/theme';
import type { GuildMember } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'GuildMemberList'>;

interface MemberWithUser extends GuildMember {
  username?: string;
  displayName?: string | null;
  avatarHash?: string | null;
}

export default function GuildMemberListScreen({ route }: Props) {
  const { guildId } = route.params;
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const data = await guildsApi.getMembers(guildId);
      // Batch fetch user info
      const userIds = data.map((m) => m.userId);
      if (userIds.length > 0) {
        try {
          const userInfos = await usersApi.getBatch(userIds);
          const userMap = new Map(userInfos.map((u) => [u.id, u]));
          const enriched: MemberWithUser[] = data.map((m) => ({
            ...m,
            username: userMap.get(m.userId)?.username,
            displayName: userMap.get(m.userId)?.displayName,
            avatarHash: userMap.get(m.userId)?.avatarHash,
          }));
          setMembers(enriched);
        } catch {
          // Fallback: use members without user details
          setMembers(data);
        }
      } else {
        setMembers(data);
      }
    } catch (err: any) {
      if (err.status !== 401) {
        Alert.alert('Error', 'Failed to load members');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const renderMember = ({ item }: { item: MemberWithUser }) => {
    const name = item.displayName || item.nickname || item.username || item.userId.slice(0, 8);
    const initial = name.charAt(0).toUpperCase();

    return (
      <View style={styles.memberRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName} numberOfLines={1}>{name}</Text>
          {item.username && item.displayName && (
            <Text style={styles.memberUsername} numberOfLines={1}>@{item.username}</Text>
          )}
        </View>
        <Text style={styles.joinDate}>
          Joined {new Date(item.joinedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerCount}>{members.length} member{members.length !== 1 ? 's' : ''}</Text>
      </View>
      <FlatList
        data={members}
        keyExtractor={(item) => item.userId}
        renderItem={renderMember}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchMembers(); }}
            tintColor={colors.accentPrimary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No members found</Text>
          </View>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
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
  list: {
    paddingBottom: spacing.xxxl,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  memberUsername: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  joinDate: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
  },
});
