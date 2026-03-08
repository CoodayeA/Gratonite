import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';

interface ReplyBarProps {
  username: string;
  onClose: () => void;
}

export default function ReplyBar({ username, onClose }: ReplyBarProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgSecondary,
      paddingVertical: spacing.sm,
      paddingRight: spacing.md,
    },
    accentBorder: {
      width: 3,
      height: '100%',
      backgroundColor: colors.accentPrimary,
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    text: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      flex: 1,
    },
    username: {
      color: colors.textPrimary,
      fontWeight: '600',
    },
    closeBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <View style={styles.container}>
      <View style={styles.accentBorder} />
      <View style={styles.content}>
        <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.text} numberOfLines={1}>
          Replying to <Text style={styles.username}>@{username}</Text>
        </Text>
      </View>
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}
