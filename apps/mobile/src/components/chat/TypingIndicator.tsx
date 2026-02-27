import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useMessagesStore } from '../../stores/messages.store';
import { useAuthStore } from '../../stores/auth.store';
import { colors, spacing, fontSize } from '../../theme';

// ── Types ────────────────────────────────────────────

interface TypingIndicatorProps {
  channelId: string;
}

// ── Constants ────────────────────────────────────────

const TYPING_TIMEOUT_MS = 8000;
const CLEANUP_INTERVAL_MS = 2000;

// ── Animated dot component ───────────────────────────

function AnimatedDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, // infinite
        false,
      ),
    );
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

// ── Component ────────────────────────────────────────

export function TypingIndicator({ channelId }: TypingIndicatorProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const typingByChannel = useMessagesStore((s) => s.typingByChannel);
  const clearTyping = useMessagesStore((s) => s.clearTyping);

  // Clean up stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const channelTyping = typingByChannel.get(channelId);
      if (!channelTyping) return;

      const now = Date.now();
      for (const [userId, timestamp] of channelTyping) {
        if (now - timestamp > TYPING_TIMEOUT_MS) {
          clearTyping(channelId, userId);
        }
      }
    }, CLEANUP_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [channelId, typingByChannel, clearTyping]);

  // Get list of typing users, excluding the current user
  const typingUsers = useMemo(() => {
    const channelTyping = typingByChannel.get(channelId);
    if (!channelTyping) return [];

    const now = Date.now();
    const users: string[] = [];

    for (const [userId, timestamp] of channelTyping) {
      if (userId !== currentUserId && now - timestamp <= TYPING_TIMEOUT_MS) {
        users.push(userId);
      }
    }

    return users;
  }, [channelId, currentUserId, typingByChannel]);

  // Container height animation
  const containerHeight = useSharedValue(0);

  useEffect(() => {
    containerHeight.value = withTiming(typingUsers.length > 0 ? 24 : 0, {
      duration: 200,
      easing: Easing.inOut(Easing.ease),
    });
  }, [typingUsers.length, containerHeight]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    height: containerHeight.value,
    opacity: containerHeight.value > 0 ? 1 : 0,
  }));

  // Build the display text
  const displayText = useMemo(() => {
    if (typingUsers.length === 0) return '';
    if (typingUsers.length === 1) {
      return `${typingUsers[0]} is typing`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0]} and ${typingUsers[1]} are typing`;
    }
    const othersCount = typingUsers.length - 2;
    return `${typingUsers[0]}, ${typingUsers[1]}, and ${othersCount} ${othersCount === 1 ? 'other is' : 'others are'} typing`;
  }, [typingUsers]);

  if (typingUsers.length === 0) {
    return <Animated.View style={containerAnimatedStyle} />;
  }

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]}>
      <View style={styles.dotsContainer}>
        <AnimatedDot delay={0} />
        <AnimatedDot delay={150} />
        <AnimatedDot delay={300} />
      </View>
      <Text style={styles.text} numberOfLines={1}>
        {displayText}
      </Text>
    </Animated.View>
  );
}

// ── Styles ───────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginRight: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text.secondary,
  },
  text: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    flex: 1,
  },
});
