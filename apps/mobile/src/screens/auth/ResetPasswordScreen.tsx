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
import { CommonActions } from '@react-navigation/native';
import { auth } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { StarField, RainbowStrip } from '../../components/decorative';
import type { AuthStackParamList, AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>
  | NativeStackScreenProps<AppStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen({ route, navigation }: Props) {
  // Determine if Login screen exists in this navigator (auth stack vs app stack)
  const canNavigateToLogin = navigation.getState().routeNames.includes('Login');

  const handleNavigateAway = () => {
    if (canNavigateToLogin) {
      (navigation as any).navigate('Login');
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }));
    }
  };
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const routeToken = route.params?.token;
  const [token, setToken] = useState(routeToken || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const passwordError = password.length > 0 && password.length < 8
    ? 'Password must be at least 8 characters'
    : '';
  const confirmError = confirmPassword.length > 0 && password !== confirmPassword
    ? 'Passwords do not match'
    : '';

  const handleReset = async () => {
    if (!token.trim()) {
      const message = 'Please enter your reset code';
      setError(message);
      toast.error(message);
      return;
    }
    if (password.length < 8) {
      const message = 'Password must be at least 8 characters';
      setError(message);
      toast.error(message);
      return;
    }
    if (password !== confirmPassword) {
      const message = 'Passwords do not match';
      setError(message);
      toast.error(message);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await auth.resetPassword(token.trim(), password);
      setSuccess(true);
    } catch (err: any) {
      const msg = err.message || 'Something went wrong';
      if (msg.toLowerCase().includes('expired')) {
        const message = 'This reset link has expired. Please request a new one.';
        setError(message);
        toast.error(message);
      } else if (msg.toLowerCase().includes('invalid')) {
        const message = 'Invalid reset code. Please check and try again.';
        setError(message);
        toast.error(message);
      } else {
        setError(msg);
        toast.error(msg);
      }
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
      fontSize: neo ? 32 : 28,
      fontWeight: neo ? '900' : '700',
      color: colors.textPrimary,
      textAlign: 'center',
      textTransform: neo ? 'uppercase' : 'none',
      letterSpacing: neo ? 1 : 0,
      lineHeight: neo ? 38 : 34,
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
    eyeButton: {
      padding: spacing.xs,
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
    errorText: {
      color: colors.error,
      fontSize: fontSize.sm,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    validationText: {
      color: colors.error,
      fontSize: fontSize.xs,
      marginTop: 2,
      marginLeft: spacing.lg,
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

          {success ? (
            /* Success state */
            <Animated.View entering={FadeInDown.duration(600)} style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle-outline" size={32} color={colors.success} />
              </View>
              <Text style={styles.successTitle}>Password Updated!</Text>
              <Text style={styles.successSubtitle}>
                Your password has been reset successfully. You can now sign in with your new password.
              </Text>

              <TouchableOpacity
                style={styles.button}
                onPress={handleNavigateAway}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
              >
                <Text style={styles.buttonText}>Sign In</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <>
              {/* Heading */}
              <Animated.View entering={FadeInDown.duration(600).delay(100)}>
                <Text style={styles.heading}>
                  RESET{'\n'}
                  <Text style={styles.headingAccent}>PASSWORD.</Text>
                </Text>
                <Text style={styles.subtitle}>
                  Enter your reset code and choose a new password
                </Text>
              </Animated.View>

              {/* Form */}
              <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.form}>
                {/* Token input (hidden if provided via route params) */}
                {!routeToken && (
                  <View>
                    <View style={styles.inputContainer}>
                      <Ionicons name="key-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        value={token}
                        onChangeText={setToken}
                        placeholder="Reset code from email"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        accessibilityLabel="Reset code"
                      />
                    </View>
                  </View>
                )}

                {/* New Password */}
                <View>
                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="New password"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!showPassword}
                      accessibilityLabel="New password"
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                  {passwordError ? <Text style={styles.validationText}>{passwordError}</Text> : null}
                </View>

                {/* Confirm Password */}
                <View>
                  <View style={styles.inputContainer}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!showConfirmPassword}
                      accessibilityLabel="Confirm new password"
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                  {confirmError ? <Text style={styles.validationText}>{confirmError}</Text> : null}
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleReset}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Reset password"
                >
                  {loading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.buttonText}>Reset Password</Text>
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
                  onPress={handleNavigateAway}
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
