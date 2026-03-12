import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface FloatingStarProps {
  size: number;
  color: string;
  top: number;
  left?: number;
  right?: number;
  duration?: number;
  amplitude?: number;
}

export default function FloatingStar({
  size,
  color,
  top,
  left,
  right,
  duration = 2400,
  amplitude = 8,
}: FloatingStarProps) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(-amplitude, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', top, left, right }, animStyle]}>
      <Ionicons name="star" size={size} color={color} />
    </Animated.View>
  );
}
