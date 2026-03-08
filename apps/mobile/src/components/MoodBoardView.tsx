import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useTheme } from '../lib/theme';
import type { MoodBoardItem } from '../types';

interface Props {
  items: MoodBoardItem[];
}

export default function MoodBoardView({ items }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    card: {
      flex: 1,
      margin: spacing.xs,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      gap: spacing.sm,
    },
    emoji: {
      fontSize: 32,
    },
    text: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      textAlign: 'center',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderItem = ({ item }: { item: MoodBoardItem }) => (
    <View style={[styles.card, item.color ? { backgroundColor: item.color } : undefined]}>
      <Text style={styles.emoji}>{item.emoji}</Text>
      <Text style={styles.text}>{item.text}</Text>
    </View>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      numColumns={2}
      scrollEnabled={false}
    />
  );
}
