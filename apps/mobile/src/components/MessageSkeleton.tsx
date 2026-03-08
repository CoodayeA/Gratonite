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

function SkeletonRow({ short, colors }: { short?: boolean; colors: any }) {
  return (
    <View style={styles.row}>
      <PulsingBar width={32} height={32} colors={colors} />
      <View style={styles.lines}>
        <PulsingBar width={short ? 80 : 120} height={12} colors={colors} />
        <PulsingBar width={short ? 140 : 200} height={10} colors={colors} />
      </View>
    </View>
  );
}

export default function MessageSkeleton() {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <SkeletonRow colors={colors} />
      <SkeletonRow short colors={colors} />
      <SkeletonRow colors={colors} />
      <SkeletonRow short colors={colors} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  lines: {
    flex: 1,
    gap: spacing.sm,
  },
});
