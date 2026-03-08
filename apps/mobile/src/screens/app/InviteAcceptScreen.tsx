import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { invites as invitesApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import type { InvitePreview } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'InviteAccept'>;

export default function InviteAcceptScreen({ route, navigation }: Props) {
  const { code } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await invitesApi.preview(code);
        setPreview(data);
      } catch (err: any) {
        setError(err.message || 'Invite not found or expired');
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const result = await invitesApi.accept(code);
      if (result.guildId) {
        navigation.replace('GuildChannels', {
          guildId: result.guildId,
          guildName: preview?.guild.name ?? 'Server',
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to join server');
      setJoining(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    card: {
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.xl,
      padding: spacing.xxl,
      alignItems: 'center',
      width: '100%',
      maxWidth: 360,
      borderWidth: 1,
      borderColor: colors.border,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border, shadowColor: neo.shadowColor, shadowOffset: neo.shadowOffset, shadowOpacity: neo.shadowOpacity, shadowRadius: neo.shadowRadius } : {}),
    },
    guildIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    guildIconText: {
      color: colors.white,
      fontSize: fontSize.xxl,
      fontWeight: '700',
    },
    inviteLabel: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginBottom: spacing.xs,
    },
    guildName: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: neo ? '800' : '700',
      textAlign: 'center',
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
    },
    guildDesc: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    statText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
    joinButton: {
      marginTop: spacing.xl,
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xxxl,
      width: '100%',
      alignItems: 'center',
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    joinButtonDisabled: {
      opacity: 0.6,
    },
    joinButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    errorText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      marginTop: spacing.lg,
      textAlign: 'center',
    },
    backButton: {
      marginTop: spacing.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xxl,
    },
    backButtonText: {
      color: colors.accentPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  if (error || !preview) {
    return (
      <View style={styles.container}>
        <Ionicons name="close-circle-outline" size={64} color={colors.error} />
        <Text style={styles.errorText}>{error ?? 'Invite not found'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.guildIcon}>
          <Text style={styles.guildIconText}>
            {preview.guild.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.inviteLabel}>You have been invited to join</Text>
        <Text style={styles.guildName}>{preview.guild.name}</Text>
        {preview.guild.description ? (
          <Text style={styles.guildDesc}>{preview.guild.description}</Text>
        ) : null}
        <View style={styles.statsRow}>
          <Ionicons name="people-outline" size={16} color={colors.textMuted} />
          <Text style={styles.statText}>{preview.guild.memberCount} members</Text>
        </View>
        <TouchableOpacity
          style={[styles.joinButton, joining && styles.joinButtonDisabled]}
          onPress={handleJoin}
          disabled={joining}
        >
          <Text style={styles.joinButtonText}>
            {joining ? 'Joining...' : 'Accept Invite'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
