import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useColors, spacing } from '../lib/theme';

function PulsingBar({ width, height, colors }: { width: number | string; height: number; colors: any }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: height / 2, backgroundColor: colors.bgElevated },
        style,
      ]}
    />
  );
}

function ListSkeletonRow({ colors }: { colors: any }) {
  return (
    <View style={styles.row}>
      <PulsingBar width={44} height={44} colors={colors} />
      <View style={styles.lines}>
        <PulsingBar width={120} height={14} colors={colors} />
        <PulsingBar width={180} height={10} colors={colors} />
      </View>
    </View>
  );
}

export default function ListSkeleton({ count = 6 }: { count?: number }) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <ListSkeletonRow key={i} colors={colors} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  lines: {
    flex: 1,
    gap: spacing.sm,
  },
});
