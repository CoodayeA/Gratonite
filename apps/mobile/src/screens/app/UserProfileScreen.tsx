import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { users as usersApi, relationships as relApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import Avatar from '../../components/Avatar';
import type { User, PresenceStatus } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'UserProfile'>;

const STATUS_LABELS: Record<PresenceStatus, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  invisible: 'Offline',
  offline: 'Offline',
};

export default function UserProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const STATUS_COLORS: Record<PresenceStatus, string> = useMemo(() => ({
    online: colors.online,
    idle: colors.idle,
    dnd: colors.dnd,
    invisible: colors.offline,
    offline: colors.offline,
  }), [colors]);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await usersApi.getProfile(userId);
      setProfile(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleMessage = async () => {
    setActionLoading(true);
    try {
      const dm = await relApi.openDM(userId);
      navigation.navigate('DirectMessage', {
        channelId: dm.id,
        recipientName: profile?.displayName || profile?.username || 'User',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to open DM');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddFriend = async () => {
    setActionLoading(true);
    try {
      await relApi.sendFriendRequest(userId);
      toast.success('Friend request sent');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send friend request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    Alert.alert('Remove Friend', 'Are you sure you want to remove this friend?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await relApi.removeFriend(userId);
            toast.success('Friend removed');
          } catch (err: any) {
            toast.error(err.message || 'Failed to remove friend');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleBlock = async () => {
    Alert.alert('Block User', 'Are you sure you want to block this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await relApi.block(userId);
            toast.success('User blocked');
          } catch (err: any) {
            toast.error(err.message || 'Failed to block user');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
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
      gap: spacing.md,
    },
    errorText: {
      color: colors.textMuted,
      fontSize: fontSize.md,
    },
    banner: {
      height: 120,
      backgroundColor: colors.bgElevated,
    },
    avatarContainer: {
      alignItems: 'flex-start',
      marginTop: -40,
      paddingHorizontal: spacing.lg,
    },
    avatarBorder: {
      borderRadius: 44,
      borderWidth: 4,
      borderColor: colors.bgPrimary,
      borderCurve: 'continuous',
    },
    card: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxxl,
    },
    displayName: {
      fontSize: fontSize.xxl,
      fontWeight: neo ? '800' : '700',
      color: colors.textPrimary,
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
    },
    username: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      marginTop: 2,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    statusText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
    },
    customStatus: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      marginTop: spacing.xs,
      fontStyle: 'italic',
    },
    pronouns: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: spacing.xs,
    },
    bioSection: {
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    bioText: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      lineHeight: 22,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xl,
    },
    actionButtonPrimary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.accentPrimary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border, shadowColor: neo.shadowColor, shadowOffset: neo.shadowOffset, shadowOpacity: neo.shadowOpacity, shadowRadius: neo.shadowRadius } : {}),
    },
    actionButtonPrimaryText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    actionButtonSecondary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.bgElevated,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    actionButtonSecondaryText: {
      color: colors.accentPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.md,
    },
    actionButtonDestructive: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.bgElevated,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      marginTop: spacing.sm,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    actionButtonDestructiveText: {
      color: colors.error,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="person-outline" size={48} color={colors.textMuted} />
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  const displayName = profile.displayName || profile.username;

  return (
    <ScrollView style={styles.container} bounces={false}>
      {/* Banner */}
      <View style={styles.banner} />

      {/* Avatar overlapping banner */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatarBorder}>
          <Avatar
            userId={profile.id}
            avatarHash={profile.avatarHash}
            name={displayName}
            size={80}
            showStatus
            statusOverride={profile.status}
          />
        </View>
      </View>

      {/* Profile card */}
      <View style={styles.card}>
        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.username}>@{profile.username}</Text>

        {/* Status */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[profile.status] }]} />
          <Text style={styles.statusText}>{STATUS_LABELS[profile.status]}</Text>
        </View>

        {profile.customStatus && (
          <Text style={styles.customStatus}>{profile.customStatus}</Text>
        )}

        {profile.pronouns && (
          <Text style={styles.pronouns}>{profile.pronouns}</Text>
        )}

        {profile.bio && (
          <View style={styles.bioSection}>
            <Text style={styles.sectionLabel}>ABOUT ME</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButtonPrimary}
            onPress={handleMessage}
            disabled={actionLoading}
          >
            <Ionicons name="chatbubble" size={18} color={colors.white} />
            <Text style={styles.actionButtonPrimaryText}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButtonSecondary}
            onPress={handleAddFriend}
            disabled={actionLoading}
          >
            <Ionicons name="person-add" size={18} color={colors.accentPrimary} />
            <Text style={styles.actionButtonSecondaryText}>Add Friend</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.actionButtonSecondary}
          onPress={handleRemoveFriend}
          disabled={actionLoading}
        >
          <Ionicons name="person-remove" size={18} color={colors.warning} />
          <Text style={[styles.actionButtonSecondaryText, { color: colors.warning }]}>
            Remove Friend
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButtonDestructive}
          onPress={handleBlock}
          disabled={actionLoading}
        >
          <Ionicons name="ban" size={18} color={colors.error} />
          <Text style={styles.actionButtonDestructiveText}>Block</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
