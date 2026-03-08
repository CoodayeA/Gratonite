import React, { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../lib/theme';

interface NameplateTextProps {
  name: string;
  style?: string | null;
  textStyle?: any;
}

const RAINBOW_COLORS = [
  '#ff6b6b',
  '#ffa06b',
  '#ffd93d',
  '#6bff6b',
  '#6bd4ff',
  '#9b6bff',
  '#ff6bda',
];

export default function NameplateText({ name, style: cosmeticStyle, textStyle }: NameplateTextProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    base: {
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    default: {
      color: colors.textPrimary,
    },
    gold: {
      color: '#ffd700',
      textShadowColor: 'rgba(255, 215, 0, 0.3)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 4,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (cosmeticStyle === 'rainbow') {
    return (
      <Text style={[styles.base, textStyle]}>
        {name.split('').map((char, index) => (
          <Text
            key={index}
            style={{ color: RAINBOW_COLORS[index % RAINBOW_COLORS.length] }}
          >
            {char}
          </Text>
        ))}
      </Text>
    );
  }

  if (cosmeticStyle === 'gold') {
    return (
      <Text style={[styles.base, styles.gold, textStyle]}>
        {name}
      </Text>
    );
  }

  return (
    <Text style={[styles.base, styles.default, textStyle]}>
      {name}
    </Text>
  );
}
