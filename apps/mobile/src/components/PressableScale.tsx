import React from 'react';
import { type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { lightImpact } from '../lib/haptics';
import { useTheme } from '../lib/theme';

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  scaleTo?: number;
  accessibilityRole?: string;
  accessibilityLabel?: string;
}

export default function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  disabled,
  scaleTo,
  accessibilityRole,
  accessibilityLabel,
}: PressableScaleProps) {
  const { neo, glass } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const targetScale = scaleTo ?? (neo ? 0.95 : 0.97);

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      'worklet';
      scale.value = withSpring(targetScale, { damping: 15, stiffness: 400 });
      if (glass) {
        opacity.value = withSpring(0.85, { damping: 15, stiffness: 400 });
      }
    })
    .onFinalize(() => {
      'worklet';
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      opacity.value = withSpring(1, { damping: 15, stiffness: 400 });
    })
    .onEnd(() => {
      'worklet';
      runOnJS(lightImpact)();
      if (onPress) runOnJS(onPress)();
    });

  const longPress = Gesture.LongPress()
    .enabled(!disabled && !!onLongPress)
    .minDuration(400)
    .onBegin(() => {
      'worklet';
      scale.value = withSpring(targetScale, { damping: 15, stiffness: 400 });
    })
    .onEnd(() => {
      'worklet';
      runOnJS(lightImpact)();
      if (onLongPress) runOnJS(onLongPress)();
    })
    .onFinalize(() => {
      'worklet';
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      opacity.value = withSpring(1, { damping: 15, stiffness: 400 });
    });

  const gesture = Gesture.Race(longPress, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[animatedStyle, style]}
        accessible
        accessibilityRole={(accessibilityRole as any) ?? 'button'}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
