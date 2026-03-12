import React from 'react';
import { View, Text, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../lib/theme';

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function SectionCard({ title, children, style }: SectionCardProps) {
  const { colors, spacing, fontSize, borderRadius, neo, glass } = useTheme();

  const containerStyle: ViewStyle = neo
    ? {
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
        borderRadius: 0,
        overflow: 'hidden' as const,
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
      }
    : glass
    ? {
        backgroundColor: glass.glassBackground,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: glass.glassBorder,
        overflow: 'hidden' as const,
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
      }
    : {
        backgroundColor: colors.bgElevated,
        borderRadius: borderRadius.lg,
        overflow: 'hidden' as const,
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        shadowColor: colors.black,
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 2,
      };

  const titleEl = title ? (
    <Text
      style={{
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: neo ? '800' : '600',
        textTransform: 'uppercase' as const,
        letterSpacing: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.xs,
        ...(neo ? { color: colors.textPrimary } : {}),
      }}
    >
      {title}
    </Text>
  ) : null;

  return (
    <View style={[containerStyle, style]}>
      {titleEl}
      {children}
    </View>
  );
}
