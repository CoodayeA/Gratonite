import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import type { ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../lib/theme';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * A themed background that renders a subtle grid/dot pattern
 * behind its children. Adapts to the active theme:
 * - Neobrutalism: dot grid (bullet journal / comic book)
 * - Glassmorphism: fine accent-tinted dot matrix
 * - Default: graph paper grid lines
 */
export default function PatternBackground({ children, style }: Props) {
  const { width, height } = useWindowDimensions();
  const { colors, isDark, neo, glass } = useTheme();

  const patternElements = useMemo(() => {
    if (neo) {
      // Dot grid — bullet journal / comic book feel
      const spacing = 28;
      const dotSize = isDark ? 2 : 2.5;
      const dotColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)';
      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;
      const dots: React.ReactElement[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push(
            <View
              key={`${r}-${c}`}
              style={{
                position: 'absolute',
                left: c * spacing,
                top: r * spacing,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: dotColor,
              }}
            />,
          );
        }
      }
      return dots;
    }

    if (glass) {
      // Fine dot matrix with accent tint
      const spacing = 36;
      const dotSize = isDark ? 1.5 : 2;
      const dotColor = isDark
        ? 'rgba(108,99,255,0.08)'
        : 'rgba(108,99,255,0.08)';
      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;
      const dots: React.ReactElement[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push(
            <View
              key={`${r}-${c}`}
              style={{
                position: 'absolute',
                left: c * spacing,
                top: r * spacing,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: dotColor,
              }}
            />,
          );
        }
      }
      return dots;
    }

    // Default theme: graph paper grid lines
    const spacing = 24;
    const lineWidth = StyleSheet.hairlineWidth;
    const lineColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
    const lines: React.ReactElement[] = [];
    const cols = Math.ceil(width / spacing) + 1;
    const rows = Math.ceil(height / spacing) + 1;

    for (let c = 0; c < cols; c++) {
      lines.push(
        <View
          key={`v-${c}`}
          style={{
            position: 'absolute',
            left: c * spacing,
            top: 0,
            width: lineWidth,
            height,
            backgroundColor: lineColor,
          }}
        />,
      );
    }
    for (let r = 0; r < rows; r++) {
      lines.push(
        <View
          key={`h-${r}`}
          style={{
            position: 'absolute',
            top: r * spacing,
            left: 0,
            height: lineWidth,
            width,
            backgroundColor: lineColor,
          }}
        />,
      );
    }
    return lines;
  }, [width, height, isDark, neo, glass]);

  return (
    <View style={[{ flex: 1, backgroundColor: colors.bgPrimary }, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {patternElements}
      </View>
      {children}
    </View>
  );
}
