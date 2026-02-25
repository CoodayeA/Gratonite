import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { AuthStackParamList } from '../../navigation/types';
import { authApi } from '../../lib/api';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'VerifyEmailPending'>;
type Route = RouteProp<AuthStackParamList, 'VerifyEmailPending'>;

export function VerifyEmailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { email } = route.params;

  const [resending, setResending] = useState(false);

  // ── Animated spinner ──────────────────────────────────
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ── Resend handler ────────────────────────────────────
  const handleResend = useCallback(async () => {
    setResending(true);
    try {
      await authApi.requestEmailVerification(email);
      Alert.alert('Email Sent', 'A new verification email has been sent.');
    } catch {
      Alert.alert('Error', 'Failed to resend verification email. Please try again.');
    } finally {
      setResending(false);
    }
  }, [email]);

  // ── Open mail app ─────────────────────────────────────
  const handleOpenMail = useCallback(() => {
    Linking.openURL('mailto:');
  }, []);

  // ── Back to login ─────────────────────────────────────
  const handleBackToLogin = useCallback(() => {
    navigation.navigate('Login');
  }, [navigation]);

  return (
    <LinearGradient colors={['#5a4a7a', '#3e3a5a']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Spinner ring */}
          <Animated.View
            style={[
              styles.spinnerRing,
              { transform: [{ rotate: spin }] },
            ]}
          />

          {/* Status label */}
          <Text style={styles.statusLabel}>PENDING VERIFICATION</Text>

          {/* Head section */}
          <View style={styles.headSection}>
            <Text style={styles.heading}>Check Your Email</Text>
            <Text style={styles.subheading}>
              We've sent a verification link to your email address
            </Text>
            <Text style={styles.emailText}>{email}</Text>
          </View>

          {/* Resend row */}
          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive it?</Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={resending}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.resendLink, resending && styles.resendDisabled]}>
                {resending ? 'Sending...' : 'Resend'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Open Email App button */}
          <TouchableOpacity
            style={styles.openMailButton}
            onPress={handleOpenMail}
            activeOpacity={0.8}
          >
            <Text style={styles.openMailButtonText}>Open Email App</Text>
          </TouchableOpacity>

          {/* Back to Login */}
          <TouchableOpacity
            onPress={handleBackToLogin}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backToLogin}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 32,
  },

  // ── Spinner ───────────────────────────────
  spinnerRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.brand.primary,
    borderTopColor: 'transparent',
    backgroundColor: 'transparent',
  },

  // ── Status label ──────────────────────────
  statusLabel: {
    color: colors.brand.primary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
  },

  // ── Head section ──────────────────────────
  headSection: {
    alignItems: 'center',
    gap: 10,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text.primary,
  },
  subheading: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  emailText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.brand.primary,
  },

  // ── Resend row ────────────────────────────
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resendLabel: {
    fontSize: 14,
    color: colors.text.muted,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.brand.primary,
  },
  resendDisabled: {
    opacity: 0.5,
  },

  // ── Open Mail button ──────────────────────
  openMailButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.sm,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  openMailButtonText: {
    color: colors.text.inverse,
    fontSize: fontSize.md,
    fontWeight: '600',
  },

  // ── Back to Login ─────────────────────────
  backToLogin: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.muted,
  },
});
