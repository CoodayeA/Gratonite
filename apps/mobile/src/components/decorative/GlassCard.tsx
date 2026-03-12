import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme, useGlass } from '../../lib/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
}

/**
 * A frosted-glass card that uses BlurView when the glassmorphism theme is active,
 * otherwise falls back to a standard elevated card.
 */
export default function GlassCard({ children, style, intensity }: GlassCardProps) {
  const glass = useGlass();
  const { colors, borderRadius } = useTheme();

  if (!glass) {
    return (
      <View style={[styles.fallback, { backgroundColor: colors.bgElevated, borderRadius: borderRadius.lg }, style]}>
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.outer, { borderRadius: borderRadius.lg, borderColor: glass.glassBorder }, style]}>
      <BlurView
        intensity={intensity ?? glass.blurIntensity}
        tint={glass.blurTint}
        style={[styles.blur, { borderRadius: borderRadius.lg }]}
      >
        <View style={[styles.inner, { backgroundColor: glass.glassBackground }]}>
          {children}
        </View>
      </BlurView>
      {/* Top highlight edge */}
      <View style={[styles.highlight, { backgroundColor: glass.glassHighlight, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    overflow: 'hidden',
  },
  outer: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  blur: {
    overflow: 'hidden',
  },
  inner: {
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.5,
  },
});
