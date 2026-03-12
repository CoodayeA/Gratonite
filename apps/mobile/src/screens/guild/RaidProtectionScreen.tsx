import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { guilds as guildsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'RaidProtection'>;

interface GuildWithProtection {
  id: string;
  name: string;
  raidProtectionEnabled?: boolean;
  lockedAt?: string | null;
}

export default function RaidProtectionScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId } = route.params;
  const [guild, setGuild] = useState<GuildWithProtection | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [locking, setLocking] = useState(false);

  const fetchGuild = useCallback(async () => {
    try {
      const data = await guildsApi.get(guildId);
      setGuild(data as GuildWithProtection);
    } catch (err: any) {
      // silently ignore — empty state handles no data
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchGuild();
  }, [fetchGuild]);

  const handleToggleProtection = async (value: boolean) => {
    setToggling(true);
    try {
      const updated = await guildsApi.update(guildId, { raidProtectionEnabled: value } as any);
      setGuild(updated as GuildWithProtection);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update raid protection');
    } finally {
      setToggling(false);
    }
  };

  const handleToggleLock = () => {
    const isLocked = !!guild?.lockedAt;
    const action = isLocked ? 'unlock' : 'lock';

    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Portal`,
      isLocked
        ? 'This will allow new members to join the portal again.'
        : 'This will prevent any new members from joining the portal. Existing members will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: isLocked ? 'default' : 'destructive',
          onPress: async () => {
            setLocking(true);
            try {
              const updated = await guildsApi.update(guildId, {
                lockedAt: isLocked ? null : new Date().toISOString(),
              } as any);
              setGuild(updated as GuildWithProtection);
            } catch (err: any) {
              toast.error(err.message || `Failed to ${action} portal`);
            } finally {
              setLocking(false);
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
      paddingBottom: spacing.xxxl,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      color: colors.textMuted,
      fontSize: fontSize.md,
    },
    header: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.xl,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    shieldIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    shieldActive: {
      backgroundColor: 'rgba(67, 181, 129, 0.15)',
    },
    shieldInactive: {
      backgroundColor: colors.bgElevated,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.xxl,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    headerSubtitle: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      textAlign: 'center',
      lineHeight: 20,
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
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    toggleInfo: {
      flex: 1,
      marginRight: spacing.md,
    },
    toggleLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    toggleDescription: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
    statusCard: {
      marginHorizontal: spacing.lg,
      padding: spacing.lg,
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      gap: spacing.md,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    statusText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      flex: 1,
    },
    lockButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginHorizontal: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
    },
    lockButtonDanger: {
      backgroundColor: 'rgba(240, 71, 71, 0.08)',
      borderColor: 'rgba(240, 71, 71, 0.3)',
    },
    unlockButton: {
      backgroundColor: 'rgba(67, 181, 129, 0.08)',
      borderColor: 'rgba(67, 181, 129, 0.3)',
    },
    lockButtonContent: {
      flex: 1,
    },
    lockButtonText: {
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    lockButtonSubtext: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
    infoNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginTop: spacing.xxl,
      padding: spacing.lg,
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
    },
    infoNoteText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 18,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;
  if (!guild) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Failed to load portal info</Text>
      </View>
    );
  }

  const isProtectionEnabled = !!guild.raidProtectionEnabled;
  const isLocked = !!guild.lockedAt;

  return (
    <PatternBackground>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.shieldIcon, isProtectionEnabled ? styles.shieldActive : styles.shieldInactive]}>
          <Ionicons
            name={isProtectionEnabled ? 'shield-checkmark' : 'shield-outline'}
            size={40}
            color={isProtectionEnabled ? colors.success : colors.textMuted}
          />
        </View>
        <Text style={styles.headerTitle}>Raid Protection</Text>
        <Text style={styles.headerSubtitle}>
          {isProtectionEnabled
            ? 'Raid protection is active. The portal is being monitored for suspicious activity.'
            : 'Enable raid protection to automatically detect and prevent raids on your portal.'}
        </Text>
      </View>

      {/* Protection toggle */}
      <View style={styles.section}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Raid Protection</Text>
            <Text style={styles.toggleDescription}>
              Automatically detect and block raid attempts
            </Text>
          </View>
          <Switch
            value={isProtectionEnabled}
            onValueChange={handleToggleProtection}
            disabled={toggling}
            trackColor={{ false: colors.bgActive, true: colors.success }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      {/* Status info when enabled */}
      {isProtectionEnabled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PROTECTION STATUS</Text>

          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.statusText}>Anti-raid monitoring active</Text>
            </View>
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.statusText}>Suspicious join detection enabled</Text>
            </View>
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.statusText}>Automatic account age filtering</Text>
            </View>
            <View style={styles.statusRow}>
              <Ionicons
                name={isLocked ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={isLocked ? colors.warning : colors.textMuted}
              />
              <Text style={[styles.statusText, isLocked && { color: colors.warning }]}>
                {isLocked ? 'Portal is locked' : 'Portal is open to new members'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Lock/Unlock portal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PORTAL LOCKDOWN</Text>

        <TouchableOpacity
          style={[styles.lockButton, isLocked ? styles.unlockButton : styles.lockButtonDanger]}
          onPress={handleToggleLock}
          disabled={locking}
        >
          <Ionicons
            name={isLocked ? 'lock-open-outline' : 'lock-closed-outline'}
            size={22}
            color={isLocked ? colors.success : colors.error}
          />
          <View style={styles.lockButtonContent}>
            <Text style={[styles.lockButtonText, { color: isLocked ? colors.success : colors.error }]}>
              {locking
                ? (isLocked ? 'Unlocking...' : 'Locking...')
                : (isLocked ? 'Unlock Portal' : 'Lock Portal')}
            </Text>
            <Text style={styles.lockButtonSubtext}>
              {isLocked
                ? 'Allow new members to join again'
                : 'Prevent all new members from joining'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Info note */}
      <View style={styles.infoNote}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
        <Text style={styles.infoNoteText}>
          Raid protection helps keep your portal safe by detecting unusual patterns of activity,
          such as many accounts joining in a short period.
        </Text>
      </View>
    </ScrollView>
    </PatternBackground>
  );
}
