import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { PortalsStackParamList } from '../../navigation/types';
import { channelsApi, invitesApi } from '../../lib/api';
import { colors, fontSize, spacing, radius } from '../../theme';

type Route = RouteProp<PortalsStackParamList, 'GuildInvites'>;

interface Channel {
  id: string;
  name: string;
  type: string;
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export function GuildInvitesScreen() {
  const route = useRoute<Route>();
  const { guildId } = route.params;

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null,
  );
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: channels } = useQuery<Channel[]>({
    queryKey: ['guild-channels', guildId],
    queryFn: () => channelsApi.getGuildChannels(guildId),
  });

  const textChannels = channels?.filter((c) => c.type === 'GUILD_TEXT') ?? [];

  // Auto-select the first text channel
  const activeChannelId = selectedChannelId ?? textChannels[0]?.id ?? null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!activeChannelId) {
      Alert.alert('Error', 'No text channel available to create an invite.');
      return;
    }

    setGenerating(true);
    setInviteUrl(null);

    try {
      const invite = await invitesApi.create(guildId, {
        channelId: activeChannelId,
        maxAgeSeconds: 86400,
      });
      setInviteUrl(`https://gratonite.chat/invite/${invite.code}`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to create invite');
    } finally {
      setGenerating(false);
    }
  }, [guildId, activeChannelId]);

  const handleCopy = useCallback(() => {
    if (!inviteUrl) return;
    try {
      const Clipboard = require('expo-clipboard');
      Clipboard.setStringAsync(inviteUrl);
      Alert.alert('Copied!', 'Invite link copied to clipboard.');
    } catch {
      Alert.alert('Error', 'Failed to copy to clipboard.');
    }
  }, [inviteUrl]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Channel picker */}
      <Text style={styles.sectionTitle}>SELECT CHANNEL</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.channelPicker}
      >
        {textChannels.map((ch) => (
          <TouchableOpacity
            key={ch.id}
            style={[
              styles.channelPill,
              ch.id === activeChannelId && styles.channelPillActive,
            ]}
            onPress={() => {
              setSelectedChannelId(ch.id);
              setInviteUrl(null);
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.channelPillText,
                ch.id === activeChannelId && styles.channelPillTextActive,
              ]}
              numberOfLines={1}
            >
              # {ch.name}
            </Text>
          </TouchableOpacity>
        ))}
        {textChannels.length === 0 && (
          <Text style={styles.noChannelsText}>No text channels</Text>
        )}
      </ScrollView>

      {/* Generate button */}
      <TouchableOpacity
        style={[
          styles.generateBtn,
          (!activeChannelId || generating) && styles.generateBtnDisabled,
        ]}
        onPress={handleGenerate}
        activeOpacity={0.7}
        disabled={!activeChannelId || generating}
      >
        {generating ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.generateBtnText}>Generate Invite</Text>
        )}
      </TouchableOpacity>

      {/* Result */}
      {inviteUrl && (
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>INVITE LINK</Text>
          <Text style={styles.resultUrl} selectable>
            {inviteUrl}
          </Text>
          <TouchableOpacity
            style={styles.copyBtn}
            onPress={handleCopy}
            activeOpacity={0.7}
          >
            <Text style={styles.copyBtnText}>Copy Link</Text>
          </TouchableOpacity>
          <Text style={styles.expiryHint}>Expires in 24 hours</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['5xl'],
  },

  // Section
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },

  // Channel picker
  channelPicker: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  channelPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  channelPillActive: {
    backgroundColor: colors.brand.primary + '22',
    borderColor: colors.brand.primary,
  },
  channelPillText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  channelPillTextActive: {
    color: colors.brand.primary,
  },
  noChannelsText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },

  // Generate button
  generateBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  generateBtnDisabled: {
    opacity: 0.5,
  },
  generateBtnText: {
    color: '#ffffff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },

  // Result card
  resultCard: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    padding: spacing.lg,
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  resultUrl: {
    fontSize: fontSize.sm,
    color: colors.brand.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  copyBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  copyBtnText: {
    color: '#ffffff',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  expiryHint: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
});
