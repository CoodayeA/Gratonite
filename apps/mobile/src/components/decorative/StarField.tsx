import React from 'react';
import { View, StyleSheet } from 'react-native';
import FloatingStar from './FloatingStar';

/** Default star configs for background ambience */
const DEFAULT_STARS = [
  { size: 32, color: '#f59e0b', top: 60, right: 24, duration: 2400 },
  { size: 22, color: '#8b5cf6', top: 130, left: 16, duration: 2800 },
  { size: 16, color: '#3b82f6', top: 210, right: 50, duration: 3200 },
  { size: 12, color: '#6c63ff', top: 300, left: 40, duration: 2600 },
  { size: 18, color: '#ef4444', top: 380, right: 30, duration: 3000 },
];

interface StarFieldProps {
  stars?: typeof DEFAULT_STARS;
}

export default function StarField({ stars = DEFAULT_STARS }: StarFieldProps) {
  return (
    <View style={styles.container} pointerEvents="none">
      {stars.map((s, i) => (
        <FloatingStar key={i} {...s} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
