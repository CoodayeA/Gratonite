import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { lightImpact } from '../lib/haptics';
import { useColors } from '../lib/theme';

interface SwipeableMessageProps {
  children: React.ReactNode;
  onReply: () => void;
}

const THRESHOLD = 60;

export default function SwipeableMessage({ children, onReply }: SwipeableMessageProps) {
  const colors = useColors();
  const translateX = useSharedValue(0);
  const triggered = useSharedValue(false);

  const panGesture = Gesture.Pan()
    .activeOffsetX([10, 10000])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const x = Math.max(0, Math.min(e.translationX, 100));
      translateX.value = x;
      if (x >= THRESHOLD && !triggered.value) {
        triggered.value = true;
        runOnJS(lightImpact)();
      } else if (x < THRESHOLD) {
        triggered.value = false;
      }
    })
    .onEnd(() => {
      if (triggered.value) {
        runOnJS(onReply)();
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      triggered.value = false;
    });

  const messageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: Math.min(translateX.value / THRESHOLD, 1),
    transform: [{ scale: Math.min(translateX.value / THRESHOLD, 1) }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View>
        <Animated.View style={[styles.icon, iconStyle]}>
          <Ionicons name="arrow-undo" size={20} color={colors.accentPrimary} />
        </Animated.View>
        <Animated.View style={messageStyle}>
          {children}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  icon: {
    position: 'absolute',
    left: 8,
    top: '50%',
    marginTop: -12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
