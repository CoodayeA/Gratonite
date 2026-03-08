import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { guilds as guildsApi, channels as channelsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatMemberCount } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import type { Guild, Channel } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'GuildInsights'>;

export default function GuildInsightsScreen({ route }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId } = route.params;
  const [guild, setGuild] = useState<Guild | null>(null);
  const [channelList, setChannelList] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [g, chs] = await Promise.all([
          guildsApi.get(guildId),
          channelsApi.getForGuild(guildId),
        ]);
        setGuild(g);
        setChannelList(chs);
      } catch (err: any) {
        // silently ignore — empty state handles no data
      } finally {
        setLoading(false);
      }
    })();
  }, [guildId]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    error: {
      color: colors.error,
      fontSize: fontSize.md,
      textAlign: 'center',
      marginTop: 40,
    },
    banner: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    bannerIcon: {
      width: 72,
      height: 72,
      borderRadius: borderRadius.xl,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    bannerIconText: {
      color: colors.textPrimary,
      fontSize: fontSize.xxxl,
      fontWeight: '600',
    },
    bannerName: {
      color: colors.textPrimary,
      fontSize: fontSize.xxl,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    bannerDescription: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
    },
    heroCard: {
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.lg,
      padding: spacing.xxl,
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    heroValue: {
      color: colors.textPrimary,
      fontSize: fontSize.xxxl,
      fontWeight: '700',
    },
    heroLabel: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.xs,
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: '700',
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textAlign: 'center',
    },
    infoCard: {
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginTop: spacing.md,
      gap: spacing.lg,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    infoIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoContent: {
      flex: 1,
    },
    infoLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    infoValue: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!guild) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Failed to load server info</Text>
      </View>
    );
  }

  const textChannels = channelList.filter((c) => c.type === 'text' || c.type === 'GUILD_TEXT').length;
  const voiceChannels = channelList.filter((c) => c.type === 'voice' || c.type === 'GUILD_VOICE').length;
  const categories = channelList.filter((c) => c.type === 'category' || c.type === 'GUILD_CATEGORY').length;
  const totalChannels = channelList.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Server info banner */}
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Text style={styles.bannerIconText}>{guild.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.bannerName}>{guild.name}</Text>
        {guild.description && (
          <Text style={styles.bannerDescription}>{guild.description}</Text>
        )}
      </View>

      {/* Main stat: Members */}
      <View style={styles.heroCard}>
        <Ionicons name="people" size={32} color={colors.accentPrimary} />
        <Text style={styles.heroValue}>{formatMemberCount(guild.memberCount)}</Text>
        <Text style={styles.heroLabel}>Members</Text>
      </View>

      {/* Channel breakdown */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="chatbubble" size={24} color={colors.online} />
          <Text style={styles.statValue}>{textChannels}</Text>
          <Text style={styles.statLabel}>Text Channels</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="volume-medium" size={24} color={colors.idle} />
          <Text style={styles.statValue}>{voiceChannels}</Text>
          <Text style={styles.statLabel}>Voice Channels</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="folder" size={24} color={colors.info} />
          <Text style={styles.statValue}>{categories}</Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="grid" size={24} color={colors.accentPrimary} />
          <Text style={styles.statValue}>{totalChannels}</Text>
          <Text style={styles.statLabel}>Total Channels</Text>
        </View>
      </View>

      {/* Server created */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="calendar-outline" size={20} color={colors.accentPrimary} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Created</Text>
            <Text style={styles.infoValue}>
              {new Date(guild.createdAt).toLocaleDateString([], {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="person-outline" size={20} color={colors.accentPrimary} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Owner</Text>
            <Text style={styles.infoValue}>{guild.ownerId.slice(0, 12)}...</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
