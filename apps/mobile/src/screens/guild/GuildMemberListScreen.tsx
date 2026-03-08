import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { guilds as guildsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { presenceStore } from '../../lib/presenceStore';
import Avatar from '../../components/Avatar';
import { useTheme } from '../../lib/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'GuildMemberList'>;

export default function GuildMemberListScreen({ route, navigation }: Props) {
  const { guildId } = route.params;
  const toast = useToast();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { colors, spacing, fontSize, borderRadius } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
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
    sectionTitle: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '700',
      letterSpacing: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xs,
      backgroundColor: colors.bgPrimary,
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
  }), [colors, spacing, fontSize, borderRadius]);

  const fetchMembers = useCallback(async () => {
    try {
      const data = await guildsApi.getMembers(guildId);
      setMembers(data as any[]);
      // Feed presence data into store
      const updates = data.map((m: any) => ({ userId: m.userId, status: m.status ?? 'offline' }));
      presenceStore.setBulk(updates);
    } catch (err: any) {
      // silently ignore — empty state handles no data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId]);

  const sections = useMemo(() => {
    const online = members.filter((m: any) => m.status && m.status !== 'offline' && m.status !== 'invisible');
    const offline = members.filter((m: any) => !m.status || m.status === 'offline' || m.status === 'invisible');
    const result: { title: string; data: any[] }[] = [];
    if (online.length > 0) result.push({ title: `ONLINE — ${online.length}`, data: online });
    if (offline.length > 0) result.push({ title: `OFFLINE — ${offline.length}`, data: offline });
    return result;
  }, [members]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const renderMember = ({ item }: { item: any }) => {
    const name = item.displayName || item.nickname || item.username || item.userId.slice(0, 8);
    return (
      <TouchableOpacity
        style={styles.memberRow}
        onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
      >
        <Avatar userId={item.userId} avatarHash={item.avatarHash} name={name} size={40} showStatus />
        <View style={styles.memberInfo}>
          <Text style={styles.memberName} numberOfLines={1}>{name}</Text>
          {item.username && item.displayName && (
            <Text style={styles.memberUsername} numberOfLines={1}>@{item.username}</Text>
          )}
        </View>
        <Text style={styles.joinDate}>
          Joined {new Date(item.joinedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </TouchableOpacity>
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
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.userId}
        renderItem={renderMember}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
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
