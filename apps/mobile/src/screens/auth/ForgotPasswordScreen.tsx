import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { auth } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { StarField, RainbowStrip } from '../../components/decorative';
import type { AuthStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendReset = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      await auth.forgotPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxxl,
      paddingBottom: 60,
    },
    mascotContainer: {
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    mascotImage: {
      width: 80,
      height: 80,
      borderRadius: 20,
    },
    mascotGlow: {
      position: 'absolute',
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.accentPrimary,
      opacity: 0.15,
      top: -10,
    },
    heading: {
      fontSize: 28,
      fontWeight: '900',
      color: colors.textPrimary,
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 1,
      lineHeight: 34,
    },
    headingAccent: {
      color: colors.accentPrimary,
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
    },
    form: {
      gap: spacing.sm,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    inputIcon: {
      opacity: 0.5,
    },
    input: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? spacing.lg : spacing.md,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    button: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.md,
      ...(neo ? {
        borderWidth: neo.borderWidth,
        borderColor: neo.shadowColor,
        shadowColor: neo.shadowColor,
        shadowOffset: neo.shadowOffset,
        shadowOpacity: neo.shadowOpacity,
        shadowRadius: neo.shadowRadius,
        elevation: 8,
      } : {
        shadowColor: colors.accentPrimary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
      }),
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: neo ? colors.textPrimary : colors.white,
      fontSize: fontSize.md,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    stripContainer: {
      marginTop: spacing.xl,
      marginBottom: spacing.md,
      marginHorizontal: spacing.xl,
    },
    linkButton: {
      alignItems: 'center',
      marginTop: spacing.md,
    },
    linkText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
    },
    linkBold: {
      color: colors.accentPrimary,
      fontWeight: '700',
    },
    successContainer: {
      alignItems: 'center',
      gap: spacing.md,
    },
    successIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${colors.success}20`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    successTitle: {
      fontSize: fontSize.xl,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    successSubtitle: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <PatternBackground>
      <StarField />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Mascot */}
          <Animated.View entering={FadeInDown.duration(600)} style={styles.mascotContainer}>
            <View style={styles.mascotGlow} />
            <Image
              source={require('../../../assets/splash-icon.png')}
              style={styles.mascotImage}
            />
          </Animated.View>

          {sent ? (
            /* Success state */
            <Animated.View entering={FadeInDown.duration(600)} style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="mail-outline" size={32} color={colors.success} />
              </View>
              <Text style={styles.successTitle}>Check Your Email</Text>
              <Text style={styles.successSubtitle}>
                We've sent a password reset link to your email address. Please check your inbox and follow the instructions.
              </Text>

              <TouchableOpacity
                style={styles.button}
                onPress={() => navigation.navigate('Login')}
                accessibilityRole="button"
                accessibilityLabel="Back to login"
              >
                <Text style={styles.buttonText}>Back to Login</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <>
              {/* Heading */}
              <Animated.View entering={FadeInDown.duration(600).delay(100)}>
                <Text style={styles.heading}>
                  FORGOT{'\n'}
                  <Text style={styles.headingAccent}>PASSWORD?</Text>
                </Text>
                <Text style={styles.subtitle}>
                  Enter your email and we'll send you a reset link
                </Text>
              </Animated.View>

              {/* Form */}
              <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.form}>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    testID="email-input"
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email address"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    accessibilityLabel="Email address"
                  />
                </View>

                <TouchableOpacity
                  testID="send-reset-button"
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleSendReset}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Send reset link"
                >
                  {loading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.buttonText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {/* Rainbow strip */}
              <Animated.View entering={FadeInUp.duration(600).delay(400)} style={styles.stripContainer}>
                <RainbowStrip />
              </Animated.View>

              {/* Back to login link */}
              <Animated.View entering={FadeInUp.duration(600).delay(500)}>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => navigation.navigate('Login')}
                  accessibilityRole="button"
                  accessibilityLabel="Back to login"
                >
                  <Text style={styles.linkText}>
                    Remember your password? <Text style={styles.linkBold}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </PatternBackground>
  );
}
