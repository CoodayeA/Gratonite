import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { useVoice } from '../../contexts/VoiceContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLiveKit, type LiveKitParticipant } from '../../hooks/useLiveKit';
import Avatar from '../../components/Avatar';
import VoiceEffectSheet from './VoiceEffectSheet';
import SoundboardSheet from './SoundboardSheet';
import { mediumImpact } from '../../lib/haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'VoiceChannel'>;

export default function VoiceChannelScreen({ route, navigation }: Props) {
  const { channelId, channelName, guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const voiceCtx = useVoice();
  const voiceCtxRef = useRef(voiceCtx);
  voiceCtxRef.current = voiceCtx;
  const toast = useToast();
  const { user } = useAuth();
  const [hasAutoConnected, setHasAutoConnected] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showSoundboard, setShowSoundboard] = useState(false);

  const {
    isConnected,
    isConnecting,
    connectionError,
    isMuted,
    isDeafened,
    participants,
    localParticipant,
    connect,
    disconnect,
    toggleMute,
    toggleDeafen,
  } = useLiveKit({
    channelId,
    onParticipantJoined: useCallback((p: LiveKitParticipant) => {
      toast.info(`${p.name} joined`);
    }, [toast]),
    onParticipantLeft: useCallback(() => {
      toast.info('A user left the voice channel');
    }, [toast]),
  });

  // Auto-connect on mount
  useEffect(() => {
    if (!hasAutoConnected) {
      setHasAutoConnected(true);
      connect().catch(() => {});
    }
  }, [hasAutoConnected, connect]);

  // Sync voice context when connected
  useEffect(() => {
    if (isConnected) {
      voiceCtxRef.current.joinVoice(channelId, channelName, '', guildId);
      voiceCtxRef.current.registerMuteHandler(toggleMute);
    }
    return () => {
      if (isConnected) {
        voiceCtxRef.current.registerMuteHandler(null);
      }
    };
  }, [isConnected, channelId, channelName, guildId, toggleMute]);

  // Sync muted state to context
  useEffect(() => {
    voiceCtxRef.current.syncMuted(isMuted);
  }, [isMuted]);

  // Sync participant list to context
  useEffect(() => {
    const all = [
      ...(localParticipant ? [{
        id: localParticipant.id,
        username: localParticipant.name,
        isSpeaking: localParticipant.isSpeaking,
        isMuted: localParticipant.isMuted,
      }] : []),
      ...participants.map(p => ({
        id: p.id,
        username: p.name,
        isSpeaking: p.isSpeaking,
        isMuted: p.isMuted,
      })),
    ];
    voiceCtxRef.current.setParticipants(all);
  }, [participants, localParticipant]);

  const handleDisconnect = async () => {
    mediumImpact();
    await disconnect();
    voiceCtx.leaveVoice();
    navigation.goBack();
  };

  const handleMutePress = async () => {
    mediumImpact();
    await toggleMute();
  };

  const handleDeafenPress = () => {
    mediumImpact();
    toggleDeafen();
  };

  // All participants for display
  const allParticipants: LiveKitParticipant[] = useMemo(() => {
    const list: LiveKitParticipant[] = [];
    if (localParticipant) {
      list.push({ ...localParticipant, name: `${localParticipant.name} (You)` });
    }
    list.push(...participants);
    return list;
  }, [localParticipant, participants]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    header: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      gap: spacing.sm,
    },
    channelName: {
      fontSize: fontSize.xxl,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    statusText: {
      fontSize: fontSize.sm,
      color: colors.success,
      fontWeight: '600',
    },
    errorText: {
      fontSize: fontSize.sm,
      color: colors.error,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
    },
    participantList: {
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    participant: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    participantInfo: {
      flex: 1,
    },
    participantName: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    participantStatus: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
    },
    speakingRing: {
      borderWidth: 2,
      borderColor: colors.success,
      borderRadius: 24,
      padding: 2,
    },
    notSpeakingRing: {
      borderWidth: 2,
      borderColor: 'transparent',
      borderRadius: 24,
      padding: 2,
    },
    controls: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: spacing.xl,
      paddingBottom: spacing.xxxl,
      gap: spacing.lg,
    },
    controlBtn: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    disconnectBtn: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.error,
      justifyContent: 'center',
      alignItems: 'center',
    },
    connectingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.md,
    },
    connectingText: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingTop: spacing.xxxl,
      gap: spacing.sm,
    },
    emptyText: {
      fontSize: fontSize.md,
      color: colors.textMuted,
    },
    featureRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    featureBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.bgElevated,
    },
    featureBtnText: {
      fontSize: fontSize.xs,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  }), [colors, spacing, fontSize, borderRadius]);

  const renderParticipant = ({ item }: { item: LiveKitParticipant }) => (
    <View style={styles.participant}>
      <View style={item.isSpeaking ? styles.speakingRing : styles.notSpeakingRing}>
        <Avatar userId={item.id} name={item.name} size={40} />
      </View>
      <View style={styles.participantInfo}>
        <Text style={styles.participantName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.participantStatus}>
          {item.isMuted ? 'Muted' : item.isSpeaking ? 'Speaking' : 'Connected'}
        </Text>
      </View>
      {item.isMuted && (
        <Ionicons name="mic-off" size={18} color={colors.textMuted} />
      )}
    </View>
  );

  if (isConnecting) {
    return (
      <View style={[styles.container, styles.connectingContainer]}>
        <Ionicons name="volume-medium" size={40} color={colors.accentPrimary} />
        <Text style={styles.channelName}>{channelName}</Text>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
        <Text style={styles.connectingText}>Connecting to voice...</Text>
      </View>
    );
  }

  if (connectionError && !isConnected) {
    return (
      <View style={[styles.container, styles.connectingContainer]}>
        <Ionicons name="warning-outline" size={40} color={colors.error} />
        <Text style={styles.channelName}>{channelName}</Text>
        <Text style={styles.errorText}>{connectionError}</Text>
        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: colors.accentPrimary, marginTop: spacing.lg }]}
          onPress={() => connect().catch(() => {})}
        >
          <Ionicons name="refresh" size={24} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.md }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="volume-medium" size={28} color={colors.accentPrimary} />
        <Text style={styles.channelName}>{channelName}</Text>
        {isConnected && <Text style={styles.statusText}>Voice Connected</Text>}
      </View>

      <FlatList
        data={allParticipants}
        keyExtractor={(item) => item.id}
        renderItem={renderParticipant}
        contentContainerStyle={styles.participantList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>No one else is here yet</Text>
          </View>
        }
      />

      {/* Feature buttons */}
      <View style={styles.featureRow}>
        <TouchableOpacity style={styles.featureBtn} onPress={() => { mediumImpact(); setShowEffects(true); }}>
          <Ionicons name="color-wand-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.featureBtnText}>FX</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.featureBtn} onPress={() => { mediumImpact(); setShowSoundboard(true); }}>
          <Ionicons name="volume-high-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.featureBtnText}>Sounds</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.featureBtn} onPress={() => navigation.navigate('MusicRoom', { channelId, channelName })}>
          <Ionicons name="musical-notes-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.featureBtnText}>Music</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.featureBtn} onPress={() => navigation.navigate('StudyRoom', { channelId, channelName, guildId })}>
          <Ionicons name="timer-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.featureBtnText}>Study</Text>
        </TouchableOpacity>
      </View>

      {/* Voice controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, {
            backgroundColor: isMuted ? colors.error + '26' : colors.bgElevated,
          }]}
          onPress={handleMutePress}
        >
          <Ionicons
            name={isMuted ? 'mic-off' : 'mic'}
            size={24}
            color={isMuted ? colors.error : colors.textPrimary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, {
            backgroundColor: isDeafened ? colors.error + '26' : colors.bgElevated,
          }]}
          onPress={handleDeafenPress}
        >
          <Ionicons
            name={isDeafened ? 'volume-mute' : 'volume-medium'}
            size={24}
            color={isDeafened ? colors.error : colors.textPrimary}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
          <Ionicons name="call" size={24} color={colors.white} style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>

      {/* Bottom sheets */}
      <VoiceEffectSheet visible={showEffects} onClose={() => setShowEffects(false)} />
      <SoundboardSheet
        visible={showSoundboard}
        onClose={() => setShowSoundboard(false)}
        onPlaySound={(sound) => {
          toast.info(`Playing ${sound.emoji} ${sound.name}`);
        }}
      />
    </View>
  );
}
