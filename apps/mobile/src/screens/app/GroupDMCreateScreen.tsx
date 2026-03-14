import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { relationships as relApi, users as usersApi, groupDms } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import Avatar from '../../components/Avatar';
import SearchBar from '../../components/SearchBar';
import LoadErrorCard from '../../components/LoadErrorCard';
import EmptyState from '../../components/EmptyState';
import type { Relationship, User } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'GroupDMCreate'>;

interface FriendEntry {
  id: string;
  username: string;
  displayName: string | null;
  avatarHash: string | null;
}

export default function GroupDMCreateScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchFriends = useCallback(async () => {
    try {
      setLoadError(null);
      const rels = await relApi.getAll();
      const friendRels = rels.filter((r) => r.type === 'friend');
      const targetIds = friendRels.map((r) => r.targetId);

      if (targetIds.length > 0) {
        const users = await usersApi.getBatch(targetIds);
        setFriends(
          users.map((u) => ({
            id: u.id,
            username: u.username,
            displayName: u.displayName,
            avatarHash: u.avatarHash,
          })),
        );
      }
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load friends';
        if (friends.length > 0) { toast.error(message); } else { setLoadError(message); }
      }
    } finally {
      setLoading(false);
    }
  }, [friends.length]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const toggleFriend = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (selected.size < 1) {
      toast.error('Select at least one friend');
      return;
    }
    setCreating(true);
    try {
      const channel = await groupDms.create(Array.from(selected));
      navigation.replace('DirectMessage', {
        channelId: channel.id,
        recipientName: channel.name || 'Group DM',
        isGroupDm: true,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create group DM');
    } finally {
      setCreating(false);
    }
  };

  const filtered = friends.filter((f) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.username.toLowerCase().includes(q) ||
      (f.displayName?.toLowerCase().includes(q) ?? false)
    );
  });

  const selectedFriends = friends.filter((f) => selected.has(f.id));

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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      ...(neo ? { borderBottomWidth: neo.borderWidth, borderBottomColor: colors.border } : {}),
    },
    headerTitle: {
      fontSize: fontSize.xl,
      fontWeight: neo ? '800' : '700',
      color: colors.textPrimary,
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
    },
    createBtn: {
      backgroundColor: colors.accentPrimary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      minWidth: 80,
      alignItems: 'center',
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    createBtnDisabled: {
      opacity: 0.5,
    },
    createBtnText: {
      color: colors.white,
      fontWeight: '600',
      fontSize: fontSize.md,
    },
    chipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accentPrimary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      gap: spacing.xs,
    },
    chipText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: '500',
    },
    list: {
      paddingBottom: spacing.xxxl,
    },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    friendInfo: {
      flex: 1,
    },
    friendName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    friendUsername: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: borderRadius.sm,
      borderWidth: 2,
      borderColor: colors.textMuted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.accentPrimary,
      borderColor: colors.accentPrimary,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  if (loadError && friends.length === 0) return <LoadErrorCard title="Failed to load friends" message={loadError} onRetry={() => { setLoading(true); fetchFriends(); }} />;

  return (
    <PatternBackground>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New Group DM</Text>
        <TouchableOpacity
          style={[styles.createBtn, selected.size < 1 && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={creating || selected.size < 1}
        >
          {creating ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.createBtnText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Selected chips */}
      {selectedFriends.length > 0 && (
        <View style={styles.chipsContainer}>
          {selectedFriends.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={styles.chip}
              onPress={() => toggleFriend(f.id)}
            >
              <Text style={styles.chipText}>{f.displayName || f.username}</Text>
              <Ionicons name="close" size={14} color={colors.white} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search friends..."
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          const name = item.displayName || item.username;
          return (
            <TouchableOpacity
              style={styles.friendRow}
              onPress={() => toggleFriend(item.id)}
              activeOpacity={0.7}
            >
              <Avatar
                userId={item.id}
                avatarHash={item.avatarHash}
                name={name}
                size={40}
              />
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{name}</Text>
                {item.displayName && (
                  <Text style={styles.friendUsername}>@{item.username}</Text>
                )}
              </View>
              <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                {isSelected && (
                  <Ionicons name="checkmark" size={16} color={colors.white} />
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No friends found"
            subtitle="Add some friends first to create a group DM"
          />
        }
      />
    </PatternBackground>
  );
}
