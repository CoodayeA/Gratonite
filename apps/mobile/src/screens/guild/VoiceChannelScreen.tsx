import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = any;

export default function VoiceChannelScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const { channelId, channelName, guildId } = route.params;

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
    banner: {
      backgroundColor: colors.bgSecondary,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      gap: spacing.sm,
      width: '100%',
    },
    bannerText: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    backButton: {
      marginTop: spacing.xxxl,
      backgroundColor: colors.accentPrimary,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    backButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.channelInfo}>
          <Ionicons name="volume-medium" size={32} color={colors.accentPrimary} />
          <Text style={styles.channelName}>{channelName}</Text>
        </View>

        <View style={styles.banner}>
          <Ionicons name="desktop-outline" size={28} color={colors.textMuted} />
          <Text style={styles.bannerText}>Voice chat is available on desktop</Text>
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('ChannelChat', { channelId, channelName, guildId })}
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.white} />
          <Text style={styles.backButtonText}>Back to Text</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
