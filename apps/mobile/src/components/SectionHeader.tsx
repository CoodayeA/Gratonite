import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, useGlass } from '../lib/theme';

interface SectionHeaderProps {
  title: string;
}

export default function SectionHeader({ title }: SectionHeaderProps) {
  const { colors, spacing, fontSize, neo } = useTheme();
  const glass = useGlass();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xs,
      gap: spacing.sm,
    },
    accent: {
      width: 3,
      height: 12,
      borderRadius: neo ? 0 : 2,
      backgroundColor: colors.accentPrimary,
    },
    text: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: neo ? '800' : '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
  }), [colors, spacing, fontSize, neo, glass]);

  return (
    <View style={styles.container}>
      <View style={styles.accent} />
      <Text style={styles.text}>{title}</Text>
    </View>
  );
}
