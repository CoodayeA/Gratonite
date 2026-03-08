import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { voice as voiceApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = any;

export default function VoiceChannelScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { channelId, channelName } = route.params;
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);

  const joinVoice = async () => {
    setConnecting(true);
    try {
      const res = await voiceApi.join(channelId, muted, deafened);
      setToken(res.token);
      setEndpoint(res.endpoint);
      setConnected(true);
      // Note: Full LiveKit connection would use @livekit/react-native here
      // For now we show the connected state with controls
    } catch (err: any) {
      toast.error(err.message || 'Failed to join voice channel');
    } finally {
      setConnecting(false);
    }
  };

  const leaveVoice = async () => {
    try {
      await voiceApi.leave();
    } catch {
      // ignore
    }
    setConnected(false);
    setToken(null);
    setEndpoint(null);
    navigation.goBack();
  };

  useEffect(() => {
    joinVoice();
    return () => {
      // Cleanup on unmount
      if (connected) {
        voiceApi.leave().catch(() => { });
      }
    };
  }, []);

  const renderContent = () => (
    <>
      <View style={styles.content}>
        {/* Channel info */}
        <View style={styles.channelInfo}>
          <Ionicons name="volume-medium" size={32} color={colors.accentPrimary} />
          <Text style={styles.channelName}>{channelName}</Text>
          <Text style={styles.statusText}>
            {connecting ? 'Connecting...' : connected ? 'Voice Connected' : 'Disconnected'}
          </Text>
        </View>

        {/* Current user */}
        {connected && (
          <View style={styles.participant}>
            <View style={[styles.avatar, muted && styles.avatarMuted]}>
              <Text style={styles.avatarText}>
                {(user?.displayName || user?.username || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.participantName}>
              {user?.displayName || user?.username} (You)
            </Text>
            {muted && <Ionicons name="mic-off" size={16} color={colors.error} />}
            {deafened && <Ionicons name="volume-mute" size={16} color={colors.error} />}
          </View>
        )}

        {connecting && (
          <ActivityIndicator size="large" color={colors.accentPrimary} style={styles.loader} />
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, muted && styles.controlBtnActive]}
          onPress={() => setMuted(!muted)}
        >
          <Ionicons
            name={muted ? 'mic-off' : 'mic'}
            size={24}
            color={muted ? colors.error : colors.textPrimary}
          />
          <Text style={[styles.controlLabel, muted && styles.controlLabelActive]}>
            {muted ? 'Unmute' : 'Mute'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, deafened && styles.controlBtnActive]}
          onPress={() => setDeafened(!deafened)}
        >
          <Ionicons
            name={deafened ? 'volume-mute' : 'volume-medium'}
            size={24}
            color={deafened ? colors.error : colors.textPrimary}
          />
          <Text style={[styles.controlLabel, deafened && styles.controlLabelActive]}>
            {deafened ? 'Undeafen' : 'Deafen'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.hangupBtn} onPress={leaveVoice}>
          <Ionicons name="call" size={24} color={colors.white} />
          <Text style={styles.hangupLabel}>Leave</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxxl,
    },
    channelInfo: {
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xxxl,
    },
    channelName: {
      fontSize: fontSize.xxl,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    statusText: {
      fontSize: fontSize.md,
      color: colors.online,
    },
    participant: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.bgSecondary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      width: '100%',
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarMuted: {
      opacity: 0.6,
    },
    avatarText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    participantName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
      flex: 1,
    },
    loader: {
      marginTop: spacing.xxxl,
    },
    controls: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.xl,
      paddingVertical: spacing.xxxl,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.bgSecondary,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    controlBtn: {
      alignItems: 'center',
      gap: spacing.xs,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
    },
    controlBtnActive: {
      backgroundColor: 'rgba(240, 71, 71, 0.15)',
    },
    controlLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
    },
    controlLabelActive: {
      color: colors.error,
    },
    hangupBtn: {
      alignItems: 'center',
      gap: spacing.xs,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.error,
      paddingHorizontal: spacing.xl,
    },
    hangupLabel: {
      color: colors.white,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <View style={styles.container}>
      {renderContent()}
    </View>
  );
}
