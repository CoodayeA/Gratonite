import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { users as usersApi, relationships as relApi, showcase as showcaseApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import Avatar from '../../components/Avatar';
import type { User, PresenceStatus, ShowcaseItem } from '../../types';
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
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  const [mutualFriends, setMutualFriends] = useState<Array<{ id: string; username: string; displayName: string | null; avatarHash: string | null }>>([]);
  const [mutualGuilds, setMutualGuilds] = useState<Array<{ id: string; name: string; iconHash: string | null }>>([]);

  const STATUS_COLORS: Record<PresenceStatus, string> = useMemo(() => ({
    online: colors.online,
    idle: colors.idle,
    dnd: colors.dnd,
    invisible: colors.offline,
    offline: colors.offline,
  }), [colors]);

  const fetchProfile = useCallback(async () => {
    try {
      const [data, sc, friends, guilds] = await Promise.all([
        usersApi.getProfile(userId),
        showcaseApi.get(userId).catch(() => [] as ShowcaseItem[]),
        usersApi.getMutualFriends(userId).catch(() => []),
        usersApi.getMutualGuilds(userId).catch(() => []),
      ]);
      setProfile(data);
      setShowcaseItems(sc);
      setMutualFriends(friends);
      setMutualGuilds(guilds);
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
        recipientId: userId,
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
    showcaseSection: {
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    showcaseItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    showcaseImage: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.md,
      backgroundColor: colors.bgElevated,
    },
    showcaseItemInfo: {
      flex: 1,
    },
    showcaseItemTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    showcaseItemDesc: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
    badgesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    badgeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.bgElevated,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    badgeText: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    mutualSection: {
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    mutualAvatarRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    mutualGuildItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    mutualGuildIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mutualGuildName: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
    },
    presenceCard: {
      marginTop: spacing.md,
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    presenceType: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    presenceName: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    presenceDetails: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
    },
    statusEmojiText: {
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

        {/* Badges */}
        {(profile as any).badges && (profile as any).badges.length > 0 && (
          <View style={styles.badgesRow}>
            {(profile as any).badges.map((badge: any) => (
              <TouchableOpacity key={badge.id} style={styles.badgeItem} onPress={() => Alert.alert(badge.name, badge.description)}>
                <Text>{badge.icon}</Text>
                <Text style={styles.badgeText}>{badge.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Status */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[profile.status] }]} />
          <Text style={styles.statusText}>{STATUS_LABELS[profile.status]}</Text>
        </View>

        {profile.customStatus && (
          <Text style={styles.customStatus}>
            {(profile as any).statusEmoji ? `${(profile as any).statusEmoji} ` : ''}{profile.customStatus}
          </Text>
        )}

        {/* Rich Presence */}
        {(profile as any).richPresence && (
          <View style={styles.presenceCard}>
            <Ionicons name="game-controller" size={24} color={colors.accentPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.presenceType}>{(profile as any).richPresence.type}</Text>
              <Text style={styles.presenceName}>{(profile as any).richPresence.name}</Text>
              {(profile as any).richPresence.details && (
                <Text style={styles.presenceDetails}>{(profile as any).richPresence.details}</Text>
              )}
            </View>
          </View>
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

        {/* Mutual Friends */}
        {mutualFriends.length > 0 && (
          <View style={styles.mutualSection}>
            <Text style={styles.sectionLabel}>{mutualFriends.length} MUTUAL FRIENDS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.mutualAvatarRow}>
                {mutualFriends.slice(0, 10).map(f => (
                  <TouchableOpacity key={f.id} onPress={() => navigation.push('UserProfile', { userId: f.id })}>
                    <Avatar userId={f.id} avatarHash={f.avatarHash} name={f.displayName || f.username} size={40} />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Mutual Guilds */}
        {mutualGuilds.length > 0 && (
          <View style={styles.mutualSection}>
            <Text style={styles.sectionLabel}>{mutualGuilds.length} MUTUAL SERVERS</Text>
            {mutualGuilds.slice(0, 5).map(g => (
              <View key={g.id} style={styles.mutualGuildItem}>
                <View style={styles.mutualGuildIcon}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{g.name.charAt(0)}</Text>
                </View>
                <Text style={styles.mutualGuildName}>{g.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Showcase */}
        {showcaseItems.length > 0 && (
          <View style={styles.showcaseSection}>
            <Text style={styles.sectionLabel}>SHOWCASE</Text>
            {showcaseItems.map((item) => (
              <View key={item.id} style={styles.showcaseItem}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.showcaseImage} />
                ) : (
                  <View style={styles.showcaseImage} />
                )}
                <View style={styles.showcaseItemInfo}>
                  <Text style={styles.showcaseItemTitle}>{item.title}</Text>
                  {item.description && (
                    <Text style={styles.showcaseItemDesc} numberOfLines={1}>{item.description}</Text>
                  )}
                </View>
              </View>
            ))}
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

        <TouchableOpacity
          style={[styles.actionButtonSecondary, { marginTop: spacing.sm }]}
          onPress={() => navigation.navigate('KeyVerification', { userId })}
        >
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.accentPrimary} />
          <Text style={styles.actionButtonSecondaryText}>Verify Identity</Text>
        </TouchableOpacity>

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
