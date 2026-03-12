import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useGlass } from '../lib/theme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { colors, spacing, fontSize, borderRadius, neo, glass } = useTheme();
  const glassExtras = useGlass();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingTop: 80,
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
      ...(glassExtras ? {
        backgroundColor: glassExtras.glassBackground,
        borderWidth: 1,
        borderColor: glassExtras.glassBorder,
        borderRadius: borderRadius.lg,
        marginHorizontal: spacing.md,
        paddingBottom: spacing.xl,
      } : {}),
    },
    iconOuter: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.accentPrimary + '1A', // 10% opacity
      justifyContent: 'center',
      alignItems: 'center',
      transform: [{ rotate: '-3deg' }],
    },
    title: {
      color: colors.textSecondary,
      fontSize: fontSize.xl,
      fontWeight: '700',
      textAlign: 'center',
      ...(neo ? {
        textTransform: 'uppercase' as const,
        letterSpacing: 1.5,
      } : {}),
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
      ...(neo ? {
        borderRadius: 0,
        borderWidth: neo.borderWidth,
        borderColor: neo.shadowColor,
      } : glassExtras ? {
        borderRadius: borderRadius.xl,
        backgroundColor: glassExtras.glassBackground,
        borderWidth: 1,
        borderColor: glassExtras.glassBorder,
      } : {
        borderRadius: 8,
      }),
    },
    buttonText: {
      color: neo ? colors.textPrimary : glassExtras ? colors.accentPrimary : colors.white,
      fontWeight: '600',
      fontSize: fontSize.md,
    },
  }), [colors, spacing, fontSize, borderRadius, neo, glass, glassExtras]);

  return (
    <View style={styles.container}>
      <View style={styles.iconOuter}>
        <Ionicons name={icon} size={64} color={colors.accentPrimary} />
      </View>
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
