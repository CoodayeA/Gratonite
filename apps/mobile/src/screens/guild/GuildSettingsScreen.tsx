import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { guilds as guildsApi, invites as invitesApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTheme, useGlass } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import type { Guild } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'GuildSettings'>;

export default function GuildSettingsScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const glass = useGlass();
  const toast = useToast();
  const { guildId, guildName } = route.params;
  const { user } = useAuth();
  const [guild, setGuild] = useState<Guild | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchGuild = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await guildsApi.get(guildId);
      setGuild(data);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err.message || 'Failed to load portal settings';
        setLoadError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchGuild();
  }, [fetchGuild]);

  const handleLeaveServer = () => {
    Alert.alert(
      'Leave Portal',
      `Are you sure you want to leave ${guildName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await guildsApi.leave(guildId);
              // Navigate back to guild list
              navigation.popToTop();
            } catch (err: any) {
              toast.error(err.message || 'Failed to leave portal');
            }
          },
        },
      ],
    );
  };

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    try {
      const invite = await invitesApi.create(guildId, { expiresIn: 86400 }); // 24h expiry
      const inviteUrl = `https://gratonite.chat/invite/${invite.code}`;
      await Share.share({
        message: `Join ${guildName} on Gratonite! ${inviteUrl}`,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create invite');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleViewMembers = () => {
    navigation.navigate('GuildMemberList', { guildId, guildName });
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    content: {
      paddingBottom: spacing.xxxl,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    guildHeader: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        margin: spacing.md,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: glass.glassBorder,
      } : neo ? {
        borderBottomWidth: neo.borderWidth,
        borderBottomColor: colors.border,
      } : {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }),
    },
    guildIcon: {
      width: 72,
      height: 72,
      borderRadius: neo ? 0 : 36,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    guildIconText: {
      color: colors.white,
      fontSize: fontSize.xxxl,
      fontWeight: '700',
    },
    guildName: {
      color: colors.textPrimary,
      fontSize: fontSize.xxl,
      fontWeight: '700',
      textAlign: 'center',
    },
    guildDescription: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    statsRow: {
      flexDirection: 'row',
      marginTop: spacing.md,
      gap: spacing.lg,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    statText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
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
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      gap: spacing.md,
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: glass.glassBorder,
        marginHorizontal: spacing.md,
        marginBottom: spacing.xs,
      } : neo ? {
        borderTopWidth: neo.borderWidth,
        borderTopColor: colors.border,
      } : {
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }),
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
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.error + '40',
        marginHorizontal: spacing.md,
        marginBottom: spacing.xs,
      } : neo ? {
        borderTopWidth: neo.borderWidth,
        borderTopColor: colors.border,
      } : {
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }),
    },
    dangerText: {
      flex: 1,
      color: colors.error,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
  }), [colors, spacing, fontSize, borderRadius, neo, glass]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (loadError && !guild) {
    return (
      <PatternBackground>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.md }]}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.accentPrimary} />
          <Text style={[styles.guildName, { fontSize: fontSize.xl, textAlign: 'center' }]}>Failed to load portal settings</Text>
          <Text style={[styles.guildDescription, { textAlign: 'center' }]}>{loadError}</Text>
          <TouchableOpacity
            style={[styles.actionRow, { marginTop: spacing.sm, borderTopWidth: 0 }]}
            onPress={() => {
              setLoading(true);
              fetchGuild();
            }}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.accentPrimary} />
            <Text style={styles.actionText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </PatternBackground>
    );
  }

  const isOwner = guild?.ownerId === user?.id;
  const canManageGuild = isOwner;

  return (
    <PatternBackground>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* Guild info header */}
      <View style={styles.guildHeader}>
        <View style={styles.guildIcon}>
          <Text style={styles.guildIconText}>
            {(guild?.name ?? guildName).charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.guildName}>{guild?.name ?? guildName}</Text>
        {guild?.description ? (
          <Text style={styles.guildDescription}>{guild.description}</Text>
        ) : null}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="people-outline" size={16} color={colors.textMuted} />
            <Text style={styles.statText}>{guild?.memberCount ?? 0} members</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIONS</Text>

        <TouchableOpacity style={styles.actionRow} onPress={handleViewMembers}>
          <Ionicons name="people-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.actionText}>Member List</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleCreateInvite}
          disabled={creatingInvite}
        >
          <Ionicons name="link-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.actionText}>
            {creatingInvite ? 'Creating Invite...' : 'Create Invite'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {canManageGuild ? (
          <>
            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('RoleList', { guildId })}>
              <Ionicons name="shield-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Roles</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('InviteList', { guildId })}>
              <Ionicons name="mail-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Invites</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('ScheduledEvents', { guildId })}>
              <Ionicons name="calendar-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Events</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('OnboardingConfig', { guildId })}>
              <Ionicons name="school-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Onboarding</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('StarboardConfig', { guildId })}>
              <Ionicons name="star-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Starboard Settings</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('AutoRoleConfig', { guildId })}>
              <Ionicons name="person-circle-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Auto Roles</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('DigestConfig', { guildId })}>
              <Ionicons name="newspaper-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Digest</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('ActivityLog', { guildId })}>
              <Ionicons name="time-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Activity Log</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('GuildBans', { guildId })}>
              <Ionicons name="ban-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Bans</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('EmojiManagement', { guildId })}>
              <Ionicons name="happy-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Custom Emojis</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('AutomodConfig', { guildId })}>
              <Ionicons name="hardware-chip-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Automod</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('ServerTemplates', { guildId })}>
              <Ionicons name="copy-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Templates</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('AuditLog', { guildId })}>
              <Ionicons name="document-text-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Audit Log</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('WebhookManagement', { guildId })}>
              <Ionicons name="code-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Webhooks</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('WordFilterScreen', { guildId })}>
              <Ionicons name="funnel-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Word Filter</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('RaidProtection', { guildId })}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Raid Protection</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('BanAppeals', { guildId })}>
              <Ionicons name="hand-left-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Ban Appeals</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('GuildInsights', { guildId })}>
              <Ionicons name="analytics-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Portal Insights</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('GuildForms', { guildId })}>
              <Ionicons name="document-text-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Forms & Surveys</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Clips', { guildId })}>
              <Ionicons name="videocam-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Clips</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('InterestMatches', { guildId })}>
              <Ionicons name="people-circle-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.actionText}>Interest Matches</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.actionRow}>
            <Ionicons name="lock-closed-outline" size={22} color={colors.textMuted} />
            <Text style={styles.actionText}>Only the portal owner can manage server settings on mobile right now.</Text>
          </View>
        )}
      </View>

      {/* Danger zone */}
      {!isOwner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DANGER ZONE</Text>
          <TouchableOpacity style={styles.dangerRow} onPress={handleLeaveServer}>
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
            <Text style={styles.dangerText}>Leave Portal</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
    </PatternBackground>
  );
}
