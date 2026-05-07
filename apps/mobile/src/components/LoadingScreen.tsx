import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  withSequence,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';

type LoadingScreenProps = {
  title?: string;
  subtitle?: string;
};

export default function LoadingScreen({ title = 'Loading Gratonite', subtitle }: LoadingScreenProps) {
  const { colors, spacing, fontSize } = useTheme();
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false,
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    glow: {
      position: 'absolute',
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.accentPrimary,
      opacity: 0.1,
    },
    title: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '800',
      marginTop: spacing.lg,
      letterSpacing: 0.2,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
  }), [colors, fontSize, spacing]);

  return (
    <View style={styles.container}>
      <View style={styles.glow} />
      <Animated.View style={animStyle}>
        <Ionicons name="planet" size={48} color={colors.accentPrimary} />
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}
