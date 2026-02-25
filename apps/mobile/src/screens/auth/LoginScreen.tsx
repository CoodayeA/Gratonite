import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/auth.store';
import { authApi, usersApi, ApiError } from '../../lib/api';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const login = useAuthStore((s) => s.login);

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaMode, setMfaMode] = useState<'totp' | 'backup'>('totp');
  const [mfaDigits, setMfaDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [mfaBackupCode, setMfaBackupCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const digitRefs = useRef<(TextInput | null)[]>([]);

  // Auto-focus first digit when MFA modal opens in totp mode
  useEffect(() => {
    if (mfaRequired && mfaMode === 'totp') {
      setTimeout(() => digitRefs.current[0]?.focus(), 100);
    }
  }, [mfaRequired, mfaMode]);

  /** Parse error code from ApiError body */
  const getErrorCode = useCallback((err: unknown): string | null => {
    if (err instanceof ApiError) {
      try {
        const parsed = JSON.parse(err.body);
        return parsed.code ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  /** Primary login handler */
  const handleLogin = async () => {
    if (!loginId.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login({ login: loginId.trim(), password });
      // Store token immediately so subsequent API calls can use it
      useAuthStore.setState({ token: res.accessToken });
      const user = await usersApi.getMe();
      await login(
        {
          id: user.id,
          username: user.username,
          displayName: user.profile?.displayName ?? user.username,
          email: user.email,
          avatar: user.profile?.avatarHash ?? null,
          banner: user.profile?.bannerHash ?? null,
          tier: user.profile?.tier ?? 'free',
        },
        res.accessToken,
      );
    } catch (err: any) {
      const code = getErrorCode(err);
      if (code === 'MFA_REQUIRED') {
        setMfaRequired(true);
        return;
      }
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  /** MFA verification handler */
  const handleMfaVerify = async () => {
    const mfaCode = mfaDigits.join('');
    if (mfaMode === 'totp' && mfaCode.length < 6) return;
    if (mfaMode === 'backup' && !mfaBackupCode.trim()) return;

    setMfaLoading(true);
    setMfaError('');
    try {
      const res = await authApi.login({
        login: loginId.trim(),
        password,
        mfaCode: mfaMode === 'totp' ? mfaCode : undefined,
        mfaBackupCode: mfaMode === 'backup' ? mfaBackupCode.trim() : undefined,
      });
      useAuthStore.setState({ token: res.accessToken });
      const user = await usersApi.getMe();
      await login(
        {
          id: user.id,
          username: user.username,
          displayName: user.profile?.displayName ?? user.username,
          email: user.email,
          avatar: user.profile?.avatarHash ?? null,
          banner: user.profile?.bannerHash ?? null,
          tier: user.profile?.tier ?? 'free',
        },
        res.accessToken,
      );
      setMfaRequired(false);
    } catch (err: any) {
      const code = getErrorCode(err);
      if (code === 'INVALID_MFA_CODE') {
        setMfaError('Invalid code. Please try again.');
      } else {
        setMfaError(err.message ?? 'Verification failed');
      }
    } finally {
      setMfaLoading(false);
    }
  };

  /** Handle individual digit input for MFA TOTP */
  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...mfaDigits];
    newDigits[index] = digit;
    setMfaDigits(newDigits);

    // Auto-advance to next digit
    if (digit && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  /** Handle backspace to go to previous digit */
  const handleDigitKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !mfaDigits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  /** Close MFA modal and reset state */
  const closeMfaModal = () => {
    setMfaRequired(false);
    setMfaDigits(['', '', '', '', '', '']);
    setMfaBackupCode('');
    setMfaError('');
    setMfaMode('totp');
  };

  /** Toggle between TOTP and backup code mode */
  const toggleMfaMode = () => {
    if (mfaMode === 'totp') {
      setMfaMode('backup');
    } else {
      setMfaMode('totp');
      setMfaDigits(['', '', '', '', '', '']);
    }
    setMfaError('');
  };

  /** OAuth placeholder */
  const handleOAuth = (provider: string) => {
    Alert.alert('Coming Soon', `${provider} sign-in will be available soon.`);
  };

  return (
    <LinearGradient colors={['#5a4a7a', '#3e3a5a']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <View style={styles.logoContainer}>
              <View style={styles.logoBox}>
                <Text style={styles.logoText}>G</Text>
              </View>
            </View>

            {/* Heading */}
            <View style={styles.headingContainer}>
              <Text style={styles.heading}>Welcome Back</Text>
              <Text style={styles.subheading}>Sign in to continue</Text>
            </View>

            {/* Error */}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* Form Fields */}
            <View style={styles.fields}>
              {/* Email */}
              <View>
                <Text style={styles.label}>Email or Username</Text>
                <TextInput
                  style={styles.input}
                  value={loginId}
                  onChangeText={setLoginId}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholderTextColor={colors.text.muted}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>

              {/* Password */}
              <View>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholderTextColor={colors.text.muted}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
              </View>

              {/* Forgot password */}
              <TouchableOpacity
                style={styles.forgotContainer}
                onPress={() =>
                  Alert.alert('Forgot Password', 'Password reset will be available soon.')
                }
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.signInButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* OAuth Buttons */}
            <View style={styles.oauthContainer}>
              <TouchableOpacity
                style={styles.oauthButton}
                onPress={() => handleOAuth('Google')}
                activeOpacity={0.7}
              >
                <Text style={styles.oauthButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.oauthButton}
                onPress={() => handleOAuth('Discord')}
                activeOpacity={0.7}
              >
                <Text style={styles.oauthButtonText}>Continue with Discord</Text>
              </TouchableOpacity>
            </View>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Don't have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.signUpLink}> Sign up</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* MFA Modal */}
      <Modal
        visible={mfaRequired}
        transparent
        animationType="fade"
        onRequestClose={closeMfaModal}
      >
        <View style={styles.mfaOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.mfaCard}>
              {/* MFA Icon */}
              <View style={styles.mfaIconContainer}>
                <View style={styles.mfaIconBox}>
                  <Text style={styles.mfaIconText}>{'🔒'}</Text>
                </View>
              </View>

              {/* MFA Heading */}
              <View style={styles.mfaHeadingContainer}>
                <Text style={styles.mfaHeading}>Two-Factor Authentication</Text>
                <Text style={styles.mfaSubheading}>
                  {mfaMode === 'totp'
                    ? 'Enter the 6-digit code from your authenticator app'
                    : 'Enter one of your backup codes'}
                </Text>
              </View>

              {/* MFA Error */}
              {mfaError ? <Text style={styles.mfaError}>{mfaError}</Text> : null}

              {/* TOTP Digit Inputs */}
              {mfaMode === 'totp' ? (
                <View style={styles.mfaDigitsRow}>
                  {mfaDigits.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={(el) => {
                        digitRefs.current[i] = el;
                      }}
                      style={[
                        styles.mfaDigitInput,
                        digit ? styles.mfaDigitInputFilled : null,
                      ]}
                      value={digit}
                      onChangeText={(val) => handleDigitChange(i, val)}
                      onKeyPress={({ nativeEvent }) =>
                        handleDigitKeyPress(i, nativeEvent.key)
                      }
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                    />
                  ))}
                </View>
              ) : (
                <View>
                  <Text style={styles.label}>Backup Code</Text>
                  <TextInput
                    style={styles.input}
                    value={mfaBackupCode}
                    onChangeText={(val) => setMfaBackupCode(val.toUpperCase())}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    placeholderTextColor={colors.text.muted}
                    placeholder="Enter backup code"
                    returnKeyType="go"
                    onSubmitEditing={handleMfaVerify}
                  />
                </View>
              )}

              {/* Verify Button */}
              <TouchableOpacity
                style={[styles.signInButton, mfaLoading && styles.buttonDisabled]}
                onPress={handleMfaVerify}
                disabled={mfaLoading}
                activeOpacity={0.8}
              >
                {mfaLoading ? (
                  <ActivityIndicator color={colors.text.inverse} />
                ) : (
                  <Text style={styles.signInButtonText}>Verify</Text>
                )}
              </TouchableOpacity>

              {/* Toggle MFA Mode Link */}
              <TouchableOpacity
                onPress={toggleMfaMode}
                style={styles.mfaToggleContainer}
              >
                <Text style={styles.mfaToggleText}>
                  {mfaMode === 'totp'
                    ? 'Use backup code instead'
                    : 'Use authenticator app instead'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: spacing['4xl'],
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['4xl'],
  },

  // ── Logo ───────────────────────────────
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.text.inverse,
  },

  // ── Heading ────────────────────────────
  headingContainer: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
    gap: spacing.sm,
  },
  heading: {
    fontSize: 26,
    fontWeight: '600',
    color: colors.text.primary,
  },
  subheading: {
    fontSize: 14,
    color: colors.text.secondary,
  },

  // ── Fields ─────────────────────────────
  fields: {
    gap: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: '#25243a',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  forgotContainer: {
    alignItems: 'flex-end',
  },
  forgotText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.brand.primary,
  },

  // ── Error ──────────────────────────────
  error: {
    color: colors.accent.error,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
  },

  // ── Sign In Button ─────────────────────
  signInButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.sm,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    color: colors.text.inverse,
    fontSize: fontSize.md,
    fontWeight: '600',
  },

  // ── Divider ────────────────────────────
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.stroke.primary,
  },
  dividerText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },

  // ── OAuth Buttons ──────────────────────
  oauthContainer: {
    gap: spacing.md,
    marginBottom: spacing['2xl'],
  },
  oauthButton: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oauthButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },

  // ── Sign Up Link ───────────────────────
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  signUpText: {
    fontSize: 14,
    color: colors.text.muted,
  },
  signUpLink: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.brand.primary,
  },

  // ── MFA Modal ──────────────────────────
  mfaOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  mfaCard: {
    width: '100%',
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    borderRadius: radius.md,
    paddingVertical: 36,
    paddingHorizontal: 28,
  },
  mfaIconContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  mfaIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: '#d4af3730',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mfaIconText: {
    fontSize: 22,
  },
  mfaHeadingContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  mfaHeading: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  mfaSubheading: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  mfaError: {
    color: colors.accent.error,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  mfaDigitsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  mfaDigitInput: {
    width: 44,
    height: 52,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    backgroundColor: '#25243a',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '600',
    color: colors.text.primary,
  },
  mfaDigitInputFilled: {
    borderColor: colors.brand.primary,
  },
  mfaToggleContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  mfaToggleText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.brand.primary,
  },
});
