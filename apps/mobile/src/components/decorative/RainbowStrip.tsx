import React from 'react';
import { View } from 'react-native';

const RAINBOW = ['#6c63ff', '#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#8b5cf6'];

interface RainbowStripProps {
  height?: number;
}

export default function RainbowStrip({ height = 3 }: RainbowStripProps) {
  return (
    <View style={{ flexDirection: 'row', height, borderRadius: 2, overflow: 'hidden' }}>
      {RAINBOW.map((c) => (
        <View key={c} style={{ flex: 1, backgroundColor: c }} />
      ))}
    </View>
  );
}
