import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  moderation as modApi,
  roles as rolesApi,
  users as usersApi,
} from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import Avatar from '../../components/Avatar';
import SectionHeader from '../../components/SectionHeader';
import type { Role, User } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'MemberModerate'>;

const TIMEOUT_DURATIONS = [
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 86400, label: '1 day' },
  { value: 604800, label: '1 week' },
];

interface RoleWithAssigned extends Role {
  assigned: boolean;
}

export default function MemberModerateScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId, userId, username } = route.params;

  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [roleList, setRoleList] = useState<RoleWithAssigned[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTimeoutPicker, setShowTimeoutPicker] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [profile, allRoles] = await Promise.all([
        usersApi.getProfile(userId).catch(() => null),
        rolesApi.list(guildId).catch(() => [] as Role[]),
      ]);

      setUserProfile(profile);

      // For now, mark all roles as unassigned. In a real implementation,
      // the member's roles would be fetched from the member detail endpoint.
      setRoleList(
        allRoles
          .sort((a, b) => b.position - a.position)
          .map((r) => ({ ...r, assigned: false })),
      );
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load member info');
      }
    } finally {
      setLoading(false);
    }
  }, [guildId, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleRole = async (roleId: string, currentlyAssigned: boolean) => {
    try {
      if (currentlyAssigned) {
        await rolesApi.removeFromMember(guildId, userId, roleId);
      } else {
        await rolesApi.addToMember(guildId, userId, roleId);
      }
      setRoleList((prev) =>
        prev.map((r) =>
          r.id === roleId ? { ...r, assigned: !r.assigned } : r,
        ),
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role');
    }
  };

  const handleKick = () => {
    Alert.alert(
      'Kick Member',
      `Are you sure you want to kick ${username} from this server?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Kick',
          style: 'destructive',
          onPress: async () => {
            try {
              await modApi.kick(guildId, userId);
              toast.success(`${username} has been kicked`);
              navigation.goBack();
            } catch (err: any) {
              toast.error(err.message || 'Failed to kick member');
            }
          },
        },
      ],
    );
  };

  const handleBan = () => {
    Alert.alert(
      'Ban Member',
      `Are you sure you want to ban ${username}? They will not be able to rejoin unless unbanned.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban',
          style: 'destructive',
          onPress: async () => {
            try {
              await modApi.ban(guildId, userId);
              toast.success(`${username} has been banned`);
              navigation.goBack();
            } catch (err: any) {
              toast.error(err.message || 'Failed to ban member');
            }
          },
        },
      ],
    );
  };

  const handleTimeout = (duration: number, label: string) => {
    Alert.alert(
      'Timeout Member',
      `Timeout ${username} for ${label}? They won't be able to send messages during this period.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Timeout',
          style: 'destructive',
          onPress: async () => {
            try {
              await modApi.timeout(guildId, userId, duration);
              toast.success(`${username} has been timed out for ${label}`);
              setShowTimeoutPicker(false);
            } catch (err: any) {
              toast.error(err.message || 'Failed to timeout member');
            }
          },
        },
      ],
    );
  };

  const handleWarn = () => {
    Alert.alert(
      'Warn Member',
      `Send a warning to ${username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Warn',
          onPress: async () => {
            try {
              await modApi.warn(guildId, userId, 'Warned by moderator');
              toast.success(`${username} has been warned`);
            } catch (err: any) {
              toast.error(err.message || 'Failed to warn member');
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
    content: {
      paddingBottom: spacing.xxxl * 2,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userHeader: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    userName: {
      color: colors.textPrimary,
      fontSize: fontSize.xxl,
      fontWeight: '700',
      marginTop: spacing.md,
    },
    userUsername: {
      color: colors.textMuted,
      fontSize: fontSize.md,
      marginTop: spacing.xs,
    },
    userBio: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    section: {
      marginTop: spacing.md,
    },
    noRolesText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    roleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    roleColorDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    roleName: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      gap: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
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
    timeoutPicker: {
      marginHorizontal: spacing.lg,
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
      marginBottom: spacing.sm,
    },
    timeoutOption: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    timeoutOptionText: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User header */}
      <View style={styles.userHeader}>
        <Avatar
          userId={userId}
          avatarHash={userProfile?.avatarHash}
          name={username}
          size={64}
          showStatus
        />
        <Text style={styles.userName}>
          {userProfile?.displayName || username}
        </Text>
        <Text style={styles.userUsername}>@{username}</Text>
        {userProfile?.bio && (
          <Text style={styles.userBio}>{userProfile.bio}</Text>
        )}
      </View>

      {/* Roles */}
      <View style={styles.section}>
        <SectionHeader title="Roles" />
        {roleList.length === 0 ? (
          <Text style={styles.noRolesText}>No roles available</Text>
        ) : (
          roleList.map((role) => (
            <View key={role.id} style={styles.roleRow}>
              <View
                style={[
                  styles.roleColorDot,
                  { backgroundColor: role.color || colors.textMuted },
                ]}
              />
              <Text
                style={[styles.roleName, role.color ? { color: role.color } : null]}
              >
                {role.name}
              </Text>
              <Switch
                value={role.assigned}
                onValueChange={() => handleToggleRole(role.id, role.assigned)}
                trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
                thumbColor={colors.white}
              />
            </View>
          ))
        )}
      </View>

      {/* Moderation actions */}
      <View style={styles.section}>
        <SectionHeader title="Moderation" />

        <TouchableOpacity style={styles.actionRow} onPress={handleWarn}>
          <Ionicons name="warning-outline" size={22} color={colors.warning} />
          <Text style={styles.actionText}>Warn</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => setShowTimeoutPicker(!showTimeoutPicker)}
        >
          <Ionicons name="timer-outline" size={22} color={colors.warning} />
          <Text style={styles.actionText}>Timeout</Text>
          <Ionicons
            name={showTimeoutPicker ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        {showTimeoutPicker && (
          <View style={styles.timeoutPicker}>
            {TIMEOUT_DURATIONS.map((dur) => (
              <TouchableOpacity
                key={dur.value}
                style={styles.timeoutOption}
                onPress={() => handleTimeout(dur.value, dur.label)}
              >
                <Text style={styles.timeoutOptionText}>{dur.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.dangerRow} onPress={handleKick}>
          <Ionicons name="exit-outline" size={22} color={colors.error} />
          <Text style={styles.dangerText}>Kick</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.dangerRow} onPress={handleBan}>
          <Ionicons name="ban-outline" size={22} color={colors.error} />
          <Text style={styles.dangerText}>Ban</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
