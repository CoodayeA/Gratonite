import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../lib/theme';

function ShimmerBar({ width, height }: { width: number | string; height: number }) {
  const { colors, neo, glass } = useTheme();
  const shimmerX = useSharedValue(-1);

  useEffect(() => {
    shimmerX.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, []);

  const barBg = neo
    ? `${neo.palette.butter}40`
    : glass
    ? glass.glassBackground
    : colors.bgElevated;

  const barStyle: any = {
    width: width as any,
    height,
    borderRadius: neo ? 0 : height / 2,
    backgroundColor: barBg,
    overflow: 'hidden' as const,
    ...(neo ? { borderWidth: 2, borderColor: `${colors.border}40` } : {}),
  };

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value * 150 }],
  }));

  return (
    <View style={barStyle}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: -60,
            width: 60,
            height: '100%',
            backgroundColor: neo
              ? 'rgba(255,255,255,0.3)'
              : glass
              ? 'rgba(255,255,255,0.15)'
              : 'rgba(255,255,255,0.2)',
            borderRadius: height / 2,
          },
          shimmerStyle,
        ]}
      />
    </View>
  );
}

function ListSkeletonRow() {
  return (
    <View style={styles.row}>
      <ShimmerBar width={44} height={44} />
      <View style={styles.lines}>
        <ShimmerBar width={120} height={14} />
        <ShimmerBar width={180} height={10} />
      </View>
    </View>
  );
}

export default function ListSkeleton({ count = 6 }: { count?: number }) {
  const { spacing } = useTheme();

  return (
    <View style={[styles.container, { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.lg }]}>
      {Array.from({ length: count }).map((_, i) => (
        <ListSkeletonRow key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lines: {
    flex: 1,
    gap: 8,
  },
});
