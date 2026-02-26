import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import {
  LiveKitRoom,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useConnectionState,
  AudioSession,
} from '@livekit/react-native';
import type { Participant } from 'livekit-client';
import type { PortalsStackParamList } from '../../navigation/types';
import { voiceApi, channelsApi } from '../../lib/api';
import { Avatar } from '../../components/ui/Avatar';
import { colors, fontSize, spacing, radius } from '../../theme';

type Nav = NativeStackNavigationProp<PortalsStackParamList, 'VoiceChannel'>;
type Route = RouteProp<PortalsStackParamList, 'VoiceChannel'>;

// ── Participant tile ───────────────────────────────────────────────────────

function ParticipantTile({ participant }: { participant: Participant }) {
  const isMuted = !participant.isMicrophoneEnabled;

  return (
    <View style={[styles.tile, participant.isSpeaking && styles.tileSpeaking]}>
      <View style={styles.tileAvatarWrap}>
        <Avatar
          size={60}
          userId={participant.identity}
          displayName={participant.name}
        />
        {isMuted && (
          <View style={styles.muteBadge}>
            <Text style={styles.muteBadgeIcon}>{'\uD83D\uDD07'}</Text>
          </View>
        )}
      </View>
      <Text style={styles.tileName} numberOfLines={1}>
        {participant.name ?? participant.identity}
      </Text>
    </View>
  );
}

// ── Inner screen (needs LiveKitRoom context) ──────────────────────────────

function VoiceChannelInner({ channelName }: { channelName: string }) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const connectionState = useConnectionState();
  const [deafened, setDeafened] = useState(false);

  const handleMuteToggle = useCallback(async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      voiceApi.updateState({ selfMute: isMicrophoneEnabled }).catch(() => {});
    } catch {}
  }, [localParticipant, isMicrophoneEnabled]);

  const handleDeafenToggle = useCallback(async () => {
    const next = !deafened;
    setDeafened(next);
    if (next && isMicrophoneEnabled) {
      try {
        await localParticipant.setMicrophoneEnabled(false);
      } catch {}
    }
    voiceApi
      .updateState({ selfDeafen: next, selfMute: next || !isMicrophoneEnabled })
      .catch(() => {});
  }, [deafened, isMicrophoneEnabled, localParticipant]);

  const handleLeave = useCallback(async () => {
    try {
      await room.disconnect();
      await AudioSession.stopAudioSession();
    } catch {}
    voiceApi.leave().catch(() => {});
    navigation.goBack();
  }, [room, navigation]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBack}
          onPress={handleLeave}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.headerBackText}>{'\u2039'}</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerChannelIcon}>{'\uD83D\uDD0A'}</Text>
          <Text style={styles.headerChannelName} numberOfLines={1}>
            {channelName}
          </Text>
        </View>

        <View style={styles.headerRight} />
      </View>

      {/* Connected indicator */}
      <View style={styles.connectedBadge}>
        <View
          style={[
            styles.connectedDot,
            connectionState === 'connected' && styles.connectedDotActive,
          ]}
        />
        <Text style={styles.connectedText}>
          {connectionState === 'connected'
            ? 'Connected'
            : connectionState === 'reconnecting'
              ? 'Reconnecting...'
              : 'Connecting...'}
        </Text>
      </View>

      {/* Participants grid */}
      <FlatList
        data={participants}
        keyExtractor={(p) => p.identity}
        numColumns={3}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              {connectionState === 'connected'
                ? 'Waiting for others to join...'
                : 'Connecting...'}
            </Text>
          </View>
        }
        renderItem={({ item }) => <ParticipantTile participant={item} />}
      />

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.lg }]}>
        <TouchableOpacity
          style={[styles.controlBtn, !isMicrophoneEnabled && styles.controlBtnMuted]}
          onPress={handleMuteToggle}
          activeOpacity={0.7}
        >
          <Text style={styles.controlIcon}>
            {isMicrophoneEnabled ? '\uD83C\uDF99\uFE0F' : '\uD83D\uDD07'}
          </Text>
          <Text style={styles.controlLabel}>
            {isMicrophoneEnabled ? 'Mute' : 'Unmute'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, deafened && styles.controlBtnMuted]}
          onPress={handleDeafenToggle}
          activeOpacity={0.7}
        >
          <Text style={styles.controlIcon}>
            {deafened ? '\uD83D\uDD15' : '\uD83C\uDFA7'}
          </Text>
          <Text style={styles.controlLabel}>
            {deafened ? 'Undeafen' : 'Deafen'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.leaveBtn}
          onPress={handleLeave}
          activeOpacity={0.7}
        >
          <Text style={styles.controlIcon}>{'\uD83D\uDCF5'}</Text>
          <Text style={[styles.controlLabel, styles.leaveBtnLabel]}>Leave</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────

export function VoiceChannelScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { channelId } = route.params;
  const insets = useSafeAreaInsets();

  const [lkUrl, setLkUrl] = useState<string | undefined>(undefined);
  const [lkToken, setLkToken] = useState<string | undefined>(undefined);
  const [channelName, setChannelName] = useState('Voice Channel');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await AudioSession.startAudioSession();

        const [voiceData, channelData] = await Promise.all([
          voiceApi.join(channelId),
          channelsApi.get(channelId).catch(() => null),
        ]);

        setLkUrl(voiceData.url);
        setLkToken(voiceData.token);
        if (channelData?.name) setChannelName(channelData.name);
      } catch (err: any) {
        setError(err.message ?? 'Failed to connect to voice channel');
      }
    })();

    return () => {
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, [channelId]);

  if (error) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.errorBackBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.errorBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!lkUrl || !lkToken) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={styles.connectingText}>Connecting...</Text>
      </View>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={lkUrl}
      token={lkToken}
      connect={true}
      audio={true}
      video={false}
    >
      <VoiceChannelInner channelName={channelName} />
    </LiveKitRoom>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerBack: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackText: {
    fontSize: 32,
    color: colors.text.primary,
    fontWeight: '300',
    lineHeight: 36,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  headerChannelIcon: {
    fontSize: 18,
  },
  headerChannelName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerRight: {
    width: 36,
  },

  // Connected badge
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.muted,
  },
  connectedDotActive: {
    backgroundColor: '#22c55e',
  },
  connectedText: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    fontWeight: '500',
  },

  // Grid
  grid: {
    padding: spacing.lg,
    gap: spacing.xl,
  },

  // Tile
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    margin: spacing.xs,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  tileSpeaking: {
    backgroundColor: colors.brand.primary + '18',
    borderWidth: 1.5,
    borderColor: colors.brand.primary,
  },
  tileAvatarWrap: {
    position: 'relative',
  },
  muteBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteBadgeIcon: {
    fontSize: 12,
  },
  tileName: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: '500',
    maxWidth: 80,
    textAlign: 'center',
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'],
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
  },

  // Controls bar
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.stroke.primary,
    backgroundColor: colors.bg.secondary,
  },
  controlBtn: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    minWidth: 72,
  },
  controlBtnMuted: {
    backgroundColor: colors.accent.error + '22',
  },
  controlIcon: {
    fontSize: 24,
  },
  controlLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  leaveBtn: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accent.error + '22',
    minWidth: 72,
  },
  leaveBtnLabel: {
    color: colors.accent.error,
    fontWeight: '600',
  },

  // Connecting / error
  connectingText: {
    fontSize: fontSize.md,
    color: colors.text.muted,
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.accent.error,
    textAlign: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  errorBackBtn: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  errorBackBtnText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontWeight: '500',
  },
});
