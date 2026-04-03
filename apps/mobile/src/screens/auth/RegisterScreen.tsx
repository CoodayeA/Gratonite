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
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { StarField, RainbowStrip } from '../../components/decorative';
import type { AuthStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const toast = useToast();
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    const usernameRegex = /^[a-zA-Z0-9_]{3,32}$/;
    if (!usernameRegex.test(username.trim())) {
      toast.error('Username must be 3-32 characters, alphanumeric and underscores only');
      return;
    }

    setLoading(true);
    try {
      const verifiedEmail = await register(username.trim(), email.trim(), password);
      navigation.replace('VerifyEmail', { email: verifiedEmail });
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (pwd: string): 'weak' | 'fair' | 'strong' | null => {
    if (!pwd) return null;
    const hasLetters = /[a-zA-Z]/.test(pwd);
    const hasNumbers = /[0-9]/.test(pwd);
    const hasSymbols = /[^a-zA-Z0-9]/.test(pwd);
    if (pwd.length < 8 || !hasLetters) return 'weak';
    if (hasLetters && hasNumbers && hasSymbols) return 'strong';
    if (hasLetters && hasNumbers) return 'fair';
    return 'weak';
  };

  const validateUsername = () => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,32}$/;
    if (username && !usernameRegex.test(username.trim())) {
      setUsernameError('3–32 chars: letters, numbers and underscores only');
    }
  };

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address');
    }
  };

  const validatePasswordBlur = () => {
    if (password && password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
    }
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (passwordError === 'Passwords do not match') setPasswordError('');
    if (text && password && text !== password) {
      setConfirmPasswordError('Passwords do not match');
    } else {
      setConfirmPasswordError('');
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
    pillRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
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
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
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
    fieldGroup: {
      gap: spacing.xs,
    },
    fieldError: {
      fontSize: fontSize.xs,
      color: colors.error,
      marginLeft: spacing.xs,
    },
    strengthRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginLeft: spacing.xs,
    },
    strengthSegment: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
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
              JOIN THE{'\n'}
              <Text style={styles.headingAccent}>COMMUNITY.</Text>
            </Text>
            <Text style={styles.subtitle}>Create your Gratonite account</Text>
          </Animated.View>

          {/* Pill badges */}
          <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.pillRow}>
            <View style={[styles.pill, { transform: [{ rotate: '-1.5deg' }] }]}>
              <Text style={styles.pillText}>No Ads</Text>
            </View>
            <View style={[styles.pill, { borderColor: '#f59e0b', transform: [{ rotate: '2deg' }] }]}>
              <Text style={[styles.pillText, { color: '#f59e0b' }]}>Built by Friends</Text>
            </View>
            <View style={[styles.pill, { transform: [{ rotate: '-1deg' }] }]}>
              <Text style={styles.pillText}>Your Rules</Text>
            </View>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInDown.duration(600).delay(300)} style={styles.form}>
            <View style={styles.fieldGroup}>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={(text) => { setUsername(text); if (usernameError) setUsernameError(''); }}
                  onBlur={validateUsername}
                  placeholder="Username"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Username"
                />
              </View>
              {!!usernameError && <Text style={styles.fieldError}>{usernameError}</Text>}
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(text) => { setEmail(text); if (emailError) setEmailError(''); }}
                  onBlur={validateEmail}
                  placeholder="Email address"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  accessibilityLabel="Email"
                />
              </View>
              {!!emailError && <Text style={styles.fieldError}>{emailError}</Text>}
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={(text) => { setPassword(text); if (passwordError) setPasswordError(''); }}
                  onBlur={validatePasswordBlur}
                  placeholder="Password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  accessibilityLabel="Password"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  accessibilityLabel="Toggle password visibility"
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {!!passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}
              {(() => {
                const strength = getPasswordStrength(password);
                if (!strength) return null;
                const segmentColors = {
                  weak: [colors.error, colors.border, colors.border],
                  fair: [colors.warning, colors.warning, colors.border],
                  strong: [colors.success, colors.success, colors.success],
                } as const;
                const segs = segmentColors[strength];
                return (
                  <View style={styles.strengthRow} accessibilityLabel={`Password strength: ${strength}`}>
                    {segs.map((color, i) => (
                      <View key={i} style={[styles.strengthSegment, { backgroundColor: color }]} />
                    ))}
                  </View>
                );
              })()}
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.inputContainer}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={handleConfirmPasswordChange}
                  placeholder="Confirm password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showConfirmPassword}
                  accessibilityLabel="Confirm password"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  accessibilityLabel="Toggle confirm password visibility"
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {!!confirmPasswordError && <Text style={styles.fieldError}>{confirmPasswordError}</Text>}
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Create account"
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Rainbow strip */}
          <Animated.View entering={FadeInUp.duration(600).delay(500)} style={styles.stripContainer}>
            <RainbowStrip />
          </Animated.View>

          {/* Login link */}
          <Animated.View entering={FadeInUp.duration(600).delay(600)}>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('Login')}
              accessibilityRole="button"
              accessibilityLabel="Go to login"
            >
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.linkBold}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </PatternBackground>
  );
}
