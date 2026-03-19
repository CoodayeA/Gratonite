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
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../lib/theme';
import { StarField, RainbowStrip } from '../../components/decorative';
import type { AuthStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  const handleLogin = async () => {
    if (!loginInput.trim() || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (mfaRequired && !mfaCode.trim()) {
      Alert.alert('Error', 'Please enter your authentication code');
      return;
    }

    setLoading(true);
    try {
      await login(loginInput.trim(), password, mfaRequired ? mfaCode.trim() : undefined);
    } catch (err: any) {
      if (err.code === 'MFA_REQUIRED') {
        setMfaRequired(true);
      } else {
        Alert.alert('Login Failed', err.message || 'Invalid credentials');
        setMfaCode('');
      }
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#12121f',
    },
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
      width: 100,
      height: 100,
      borderRadius: 24,
    },
    mascotGlow: {
      position: 'absolute',
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.accentPrimary,
      opacity: 0.15,
      top: -10,
    },
    heading: {
      fontSize: 32,
      fontWeight: '900',
      color: colors.textPrimary,
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 1,
      lineHeight: 38,
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
    pillRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      marginBottom: spacing.xl,
    },
    pill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: 1.5,
      borderColor: colors.accentPrimary,
      backgroundColor: colors.bgElevated,
    },
    pillText: {
      fontSize: fontSize.xs,
      fontWeight: '700',
      color: colors.accentPrimary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
    stripContainer: {
      marginTop: spacing.xl,
      marginBottom: spacing.lg,
      marginHorizontal: spacing.xl,
    },
    forgotText: {
      color: colors.accentPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      textAlign: 'right',
      marginTop: spacing.xs,
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
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.xl,
      marginTop: spacing.lg,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: fontSize.sm,
      fontWeight: '800',
      color: colors.textPrimary,
      textTransform: 'uppercase',
    },
    statLabel: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
      marginTop: 2,
    },
    mfaCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      borderWidth: 1.5,
      borderColor: colors.accentPrimary,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    mfaTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    mfaTitleText: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    mfaSubtext: {
      fontSize: fontSize.xs,
      color: colors.textSecondary,
    },
    mfaInput: {
      backgroundColor: colors.bgPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      fontSize: 24,
      color: colors.textPrimary,
      textAlign: 'center',
      letterSpacing: 8,
      fontWeight: '700',
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

          {/* Heading */}
          <Animated.View entering={FadeInDown.duration(600).delay(100)}>
            <Text style={styles.heading}>
              WELCOME{'\n'}
              <Text style={styles.headingAccent}>BACK.</Text>
            </Text>
            <Text style={styles.subtitle}>Sign in to your Gratonite account</Text>
          </Animated.View>

          {/* Pill badges */}
          <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.pillRow}>
            <View style={[styles.pill, { transform: [{ rotate: '-2deg' }] }]}>
              <Text style={styles.pillText}>Friend-First</Text>
            </View>
            <View style={[styles.pill, { borderColor: '#f59e0b', transform: [{ rotate: '1.5deg' }] }]}>
              <Text style={[styles.pillText, { color: '#f59e0b' }]}>Player-Made</Text>
            </View>
            <View style={[styles.pill, { transform: [{ rotate: '-1deg' }] }]}>
              <Text style={styles.pillText}>Open Source</Text>
            </View>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInDown.duration(600).delay(300)} style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={loginInput}
                onChangeText={setLoginInput}
                placeholder="Email or username"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                accessibilityLabel="Email or username"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                accessibilityLabel="Password"
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

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {mfaRequired && (
              <Animated.View entering={FadeInDown.duration(400)} style={styles.mfaCard}>
                <View style={styles.mfaTitle}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.accentPrimary} />
                  <Text style={styles.mfaTitleText}>Two-Factor Authentication</Text>
                </View>
                <Text style={styles.mfaSubtext}>Enter the 6-digit code from your authenticator app.</Text>
                <TextInput
                  style={styles.mfaInput}
                  value={mfaCode}
                  onChangeText={setMfaCode}
                  placeholder="000000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  accessibilityLabel="Authentication code"
                />
              </Animated.View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>
                  {mfaRequired ? 'Verify & Sign In' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Rainbow strip */}
          <Animated.View entering={FadeInUp.duration(600).delay(500)} style={styles.stripContainer}>
            <RainbowStrip />
          </Animated.View>

          {/* Stats row */}
          <Animated.View entering={FadeInUp.duration(600).delay(600)} style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>Zero Cost</Text>
              <Text style={styles.statLabel}>Always</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>No Ads</Text>
              <Text style={styles.statLabel}>Ever</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>Your Data</Text>
              <Text style={styles.statLabel}>Yours</Text>
            </View>
          </Animated.View>

          {/* Register link */}
          <Animated.View entering={FadeInUp.duration(600).delay(700)}>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('Register')}
              accessibilityRole="button"
              accessibilityLabel="Go to registration"
            >
              <Text style={styles.linkText}>
                Don't have an account? <Text style={styles.linkBold}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </PatternBackground>
  );
}
