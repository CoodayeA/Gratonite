import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { groupDms, relationships as relApi, users as usersApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import Avatar from '../../components/Avatar';
import LoadErrorCard from '../../components/LoadErrorCard';
import EmptyState from '../../components/EmptyState';
import type { GroupDMChannel } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'GroupDMSettings'>;

interface FriendEntry {
  id: string;
  username: string;
  displayName: string | null;
  avatarHash: string | null;
}

export default function GroupDMSettingsScreen({ route, navigation }: Props) {
  const { channelId } = route.params;
  const { user } = useAuth();
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [channel, setChannel] = useState<GroupDMChannel | null>(null);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [friends, setFriends] = useState<FriendEntry[]>([]);

  const fetchChannel = useCallback(async () => {
    try {
      setLoadError(null);
      const dmChannels = await relApi.getDMChannels();
      const allRels = await relApi.getAll();
      const friendRels = allRels.filter((r) => r.type === 'friend');
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
      const message = err?.message || 'Failed to load group info';
      if (err.status !== 401) {
        if (channel) {
          toast.error(message);
        } else {
          setLoadError(message);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [channelId, channel, toast]);

  useEffect(() => {
    fetchChannel();
  }, [fetchChannel]);

  const handleSaveName = async () => {
    if (!groupName.trim()) return;
    setSaving(true);
    try {
      await groupDms.update(channelId, { name: groupName.trim() });
      toast.success('Group name updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update name');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    Alert.alert(
      'Remove Member',
      `Remove ${memberName} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupDms.removeMember(channelId, memberId);
              setChannel((prev) =>
                prev
                  ? {
                      ...prev,
                      recipients: prev.recipients.filter((r) => r.id !== memberId),
                    }
                  : prev,
              );
            } catch (err: any) {
              toast.error(err.message || 'Failed to remove member');
            }
          },
        },
      ],
    );
  };

  const handleAddMember = async (friendId: string) => {
    try {
      await groupDms.addMember(channelId, friendId);
      setShowAddPicker(false);
      fetchChannel();
      toast.success('Member added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member');
    }
  };

  const handleLeave = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group DM?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupDms.leave(channelId);
              navigation.popToTop();
            } catch (err: any) {
              toast.error(err.message || 'Failed to leave group');
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
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    section: {
      marginTop: spacing.xl,
    },
    sectionTitle: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      fontSize: fontSize.xs,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: spacing.lg,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    nameInput: {
      flex: 1,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    saveBtn: {
      backgroundColor: colors.accentPrimary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      minWidth: 64,
      alignItems: 'center',
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    saveBtnDisabled: {
      opacity: 0.5,
    },
    saveBtnText: {
      color: colors.white,
      fontWeight: '600',
      fontSize: fontSize.md,
    },
    addBtn: {
      padding: spacing.sm,
    },
    addPickerContainer: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    addPickerTitle: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    addPickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      gap: spacing.md,
    },
    addPickerName: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: fontSize.md,
    },
    noFriendsText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      paddingVertical: spacing.sm,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
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
    removeBtn: {
      padding: spacing.sm,
    },
    dangerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      gap: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    dangerText: {
      flex: 1,
      color: colors.error,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  if (loadError && !channel) {
    return <LoadErrorCard title="Failed to load group settings" message={loadError} onRetry={fetchChannel} />;
  }

  const recipients = channel?.recipients ?? [];
  const isOwner = channel?.ownerId === user?.id;
  const existingMemberIds = new Set(recipients.map((r) => r.id));
  const availableFriends = friends.filter((f) => !existingMemberIds.has(f.id));

  return (
    <PatternBackground>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GROUP NAME</Text>
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder={channel?.name || 'Group DM'}
            placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity
            style={[styles.saveBtn, !groupName.trim() && styles.saveBtnDisabled]}
            onPress={handleSaveName}
            disabled={saving || !groupName.trim()}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>
            MEMBERS ({recipients.length})
          </Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddPicker(!showAddPicker)}
            accessibilityLabel="Edit"
          >
            <Ionicons name="person-add-outline" size={20} color={colors.accentPrimary} />
          </TouchableOpacity>
        </View>

        {showAddPicker && (
          <View style={styles.addPickerContainer}>
            <Text style={styles.addPickerTitle}>Add Friend</Text>
            {availableFriends.length === 0 ? (
              <Text style={styles.noFriendsText}>No friends to add</Text>
            ) : (
              availableFriends.map((f) => {
                const name = f.displayName || f.username;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={styles.addPickerRow}
                    onPress={() => handleAddMember(f.id)}
                  >
                    <Avatar
                      userId={f.id}
                      avatarHash={f.avatarHash}
                      name={name}
                      size={32}
                    />
                    <Text style={styles.addPickerName}>{name}</Text>
                    <Ionicons name="add-circle-outline" size={22} color={colors.accentPrimary} />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        <FlatList
          data={recipients}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const name = item.displayName || item.username;
            const isCurrentUser = item.id === user?.id;
            return (
              <View style={styles.memberRow}>
                <Avatar
                  userId={item.id}
                  avatarHash={item.avatarHash}
                  name={name}
                  size={40}
                />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{name}</Text>
                  <Text style={styles.memberUsername}>@{item.username}</Text>
                </View>
                {isOwner && !isCurrentUser && (
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemoveMember(item.id, name)}
                    accessibilityLabel="Edit"
                  >
                    <Ionicons name="remove-circle-outline" size={22} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No members"
            />
          }
        />
      </View>

      {/* Leave group */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DANGER ZONE</Text>
        <TouchableOpacity style={styles.dangerRow} onPress={handleLeave}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={styles.dangerText}>Leave Group</Text>
        </TouchableOpacity>
      </View>
    </PatternBackground>
  );
}
