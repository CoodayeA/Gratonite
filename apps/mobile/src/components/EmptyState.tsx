import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingTop: 80,
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
    },
    title: {
      color: colors.textSecondary,
      fontSize: fontSize.lg,
      fontWeight: '600',
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
    },
    button: {
      marginTop: spacing.md,
      backgroundColor: colors.accentPrimary,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: 8,
    },
    buttonText: {
      color: colors.white,
      fontWeight: '600',
      fontSize: fontSize.md,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
