import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../lib/theme';

interface Props {
  streak: number;
}

export default function FriendshipStreakBadge({ streak }: Props) {
  const { colors, spacing, fontSize } = useTheme();

  if (streak <= 0) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: spacing.xs }}>
      <Text style={{ fontSize: fontSize.sm }}>🔥</Text>
      <Text style={{ color: colors.warning, fontSize: fontSize.xs, fontWeight: '700' }}>
        {streak}
      </Text>
    </View>
  );
}
