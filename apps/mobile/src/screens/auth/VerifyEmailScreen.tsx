import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../lib/theme';
import { auth } from '../../lib/api';
import type { AuthStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';
import { StarField } from '../../components/decorative';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen({ route, navigation }: Props) {
  const { email } = route.params;
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      await auth.requestVerifyEmail(email);
      Alert.alert('Email Sent', 'A new verification link has been sent to your email.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to resend verification email');
    } finally {
      setResending(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.accentPrimary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heading: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.white,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: spacing.sm,
    },
    emailText: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.accentPrimary,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    resendButton: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    resendButtonDisabled: {
      opacity: 0.6,
    },
    resendText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    backButton: {
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    backText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
    },
    backBold: {
      color: colors.accentPrimary,
      fontWeight: '700',
    },
  }), [colors, spacing, fontSize, borderRadius]);

  return (
    <PatternBackground>
      <StarField />
      <View style={styles.container}>
        <Animated.View entering={FadeInDown.duration(600)} style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-outline" size={36} color={colors.accentPrimary} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(100)}>
          <Text style={styles.heading}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a verification link to
          </Text>
          <Text style={styles.emailText}>{email}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(200)}>
          <Text style={[styles.subtitle, { marginBottom: spacing.xl }]}>
            Click the link in the email to verify your account, then come back here to sign in.
          </Text>

          <TouchableOpacity
            style={[styles.resendButton, resending && styles.resendButtonDisabled]}
            onPress={handleResend}
            disabled={resending}
          >
            {resending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.resendText}>Resend Verification Email</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.backText}>
              Already verified? <Text style={styles.backBold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </PatternBackground>
  );
}
