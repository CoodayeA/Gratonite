import React, { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useColors, spacing, fontSize } from '../lib/theme';

interface SectionHeaderProps {
  title: string;
}

export default function SectionHeader({ title }: SectionHeaderProps) {
  const colors = useColors();

  const styles = useMemo(() => StyleSheet.create({
    text: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '700',
      letterSpacing: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xs,
    },
  }), [colors]);

  return <Text style={styles.text}>{title.toUpperCase()}</Text>;
}
