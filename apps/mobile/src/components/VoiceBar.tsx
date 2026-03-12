import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVoice } from '../contexts/VoiceContext';
import { useTheme } from '../lib/theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';

export default function VoiceBar() {
  const { connected, channelId, channelName, guildName, guildId, muted, deafened, toggleMute, toggleDeafen, leaveVoice } = useVoice();
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgElevated,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    connectedDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#43b581',
    },
    connectedText: {
      fontSize: fontSize.xs,
      fontWeight: '600',
      color: '#43b581',
    },
    channelText: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    controlBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    disconnectBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#ed4245',
      justifyContent: 'center',
      alignItems: 'center',
    },
  }), [colors, spacing, fontSize, borderRadius]);

  if (!connected || !channelId) return null;

  const handleNavigate = () => {
    if (guildId && channelId) {
      navigation.navigate('VoiceChannel', { channelId, channelName, guildId });
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.info} onPress={handleNavigate} activeOpacity={0.7}>
        <View style={styles.statusRow}>
          <View style={styles.connectedDot} />
          <Text style={styles.connectedText}>Voice Connected</Text>
        </View>
        <Text style={styles.channelText} numberOfLines={1}>
          {channelName} / {guildName}
        </Text>
      </TouchableOpacity>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: muted ? 'rgba(237,66,69,0.15)' : 'transparent' }]}
          onPress={toggleMute}
        >
          <Ionicons
            name={muted ? 'mic-off' : 'mic'}
            size={20}
            color={muted ? '#ed4245' : colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: deafened ? 'rgba(237,66,69,0.15)' : 'transparent' }]}
          onPress={toggleDeafen}
        >
          <Ionicons
            name={deafened ? 'volume-mute' : 'volume-medium'}
            size={20}
            color={deafened ? '#ed4245' : colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.disconnectBtn} onPress={leaveVoice}>
          <Ionicons name="call" size={18} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
