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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/auth.store';
import { authApi, usersApi } from '../../lib/api';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

// ── Gradient background colors (purple velvet) ──────────────
const GRADIENT_TOP = '#5a4a7a';
const GRADIENT_BOTTOM = '#3e3a5a';

// ── Input frosted background ────────────────────────────────
const INPUT_BG = 'rgba(44, 44, 62, 0.15)';

// ── DOB helpers ─────────────────────────────────────────────
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function generateYears(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - 100; y--) {
    years.push(y);
  }
  return years;
}

function generateDays(month: number, year: number): number[] {
  const daysInMonth = month && year
    ? new Date(year, month, 0).getDate()
    : 31;
  const days: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }
  return days;
}

function isAtLeast16(month: number, day: number, year: number): boolean {
  if (!month || !day || !year) return true; // don't flag until all filled
  const today = new Date();
  const birth = new Date(year, month - 1, day);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 16;
}

// ── Dropdown component ──────────────────────────────────────
function Dropdown({
  label,
  options,
  value,
  onSelect,
  style,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onSelect: (v: string) => void;
  style?: object;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={[dropdownStyles.wrapper, style]}>
      <TouchableOpacity
        style={dropdownStyles.trigger}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            dropdownStyles.triggerText,
            !value && dropdownStyles.placeholder,
          ]}
          numberOfLines={1}
        >
          {value || label}
        </Text>
        <Text style={dropdownStyles.chevron}>{open ? '\u25B2' : '\u25BC'}</Text>
      </TouchableOpacity>

      {open && (
        <ScrollView
          style={dropdownStyles.list}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                dropdownStyles.option,
                opt.label === value && dropdownStyles.optionSelected,
              ]}
              onPress={() => {
                onSelect(opt.value);
                setOpen(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  dropdownStyles.optionText,
                  opt.label === value && dropdownStyles.optionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const dropdownStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative' as const,
    zIndex: 10,
  },
  trigger: {
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    borderRadius: radius.sm,
    height: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: {
    color: colors.text.primary,
    fontSize: 14,
    flex: 1,
  },
  placeholder: {
    color: colors.text.muted,
  },
  chevron: {
    color: colors.text.muted,
    fontSize: 10,
    marginLeft: 4,
  },
  list: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    maxHeight: 180,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    borderRadius: radius.sm,
    zIndex: 100,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.secondary,
  },
  optionSelected: {
    backgroundColor: colors.bg.tertiary,
  },
  optionText: {
    color: colors.text.primary,
    fontSize: 14,
  },
  optionTextSelected: {
    color: colors.brand.primary,
    fontWeight: '600',
  },
});

// ── Main screen ─────────────────────────────────────────────
export function RegisterScreen() {
  const navigation = useNavigation<Nav>();
  const login = useAuthStore((s) => s.login);

  // Form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // DOB state
  const [dobMonth, setDobMonth] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobYear, setDobYear] = useState('');

  // Status
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Derived
  const monthNum = dobMonth ? parseInt(dobMonth, 10) : 0;
  const dayNum = dobDay ? parseInt(dobDay, 10) : 0;
  const yearNum = dobYear ? parseInt(dobYear, 10) : 0;

  const dobValid = isAtLeast16(monthNum, dayNum, yearNum);
  const dobComplete = !!dobMonth && !!dobDay && !!dobYear;

  const years = useMemo(() => generateYears(), []);
  const days = useMemo(
    () => generateDays(monthNum, yearNum || new Date().getFullYear()),
    [monthNum, yearNum],
  );

  const monthOptions = MONTHS.map((m, i) => ({
    label: m,
    value: String(i + 1),
  }));

  const dayOptions = days.map((d) => ({
    label: String(d),
    value: String(d),
  }));

  const yearOptions = years.map((y) => ({
    label: String(y),
    value: String(y),
  }));

  const handleRegister = async () => {
    // Validate required fields
    if (
      !fullName.trim() ||
      !username.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      setError('Please fill in all required fields.');
      return;
    }

    // Validate DOB if provided
    if (dobComplete && !dobValid) {
      setError('You must be at least 16 years old to create an account.');
      return;
    }

    // Require DOB
    if (!dobComplete) {
      setError('Please enter your date of birth.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await authApi.register({
        username: username.trim(),
        email: email.trim(),
        password,
        displayName: fullName.trim(),
      } as any);

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
      setError(err.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // DOB display values
  const monthDisplay = dobMonth
    ? (MONTHS[parseInt(dobMonth, 10) - 1] ?? '')
    : '';
  const dayDisplay = dobDay || '';
  const yearDisplay = dobYear || '';

  return (
    <View style={styles.gradientContainer}>
      {/* Simulated gradient background */}
      <View style={styles.gradientTop} />
      <View style={styles.gradientBottom} />

      <SafeAreaView style={styles.safeArea}>
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
              <View style={styles.logo}>
                <Text style={styles.logoText}>G</Text>
              </View>
            </View>

            {/* Heading */}
            <View style={styles.headingContainer}>
              <Text style={styles.heading}>Create Account</Text>
              <Text style={styles.subheading}>Join the community</Text>
            </View>

            {/* Form fields */}
            <View style={styles.form}>
              {/* Full Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholderTextColor={colors.text.muted}
                  placeholder="Enter your full name"
                  returnKeyType="next"
                />
              </View>

              {/* Username */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor={colors.text.muted}
                  placeholder="Choose a username"
                  returnKeyType="next"
                />
              </View>

              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholderTextColor={colors.text.muted}
                  placeholder="Enter your email"
                  returnKeyType="next"
                />
              </View>

              {/* Date of Birth */}
              <View style={[styles.fieldGroup, { zIndex: 20 }]}>
                <Text style={styles.label}>Date of Birth</Text>
                <View style={styles.dobRow}>
                  <Dropdown
                    label="Month"
                    options={monthOptions}
                    value={monthDisplay}
                    onSelect={setDobMonth}
                    style={{ zIndex: 30 }}
                  />
                  <Dropdown
                    label="Day"
                    options={dayOptions}
                    value={dayDisplay}
                    onSelect={setDobDay}
                    style={{ zIndex: 30 }}
                  />
                  <Dropdown
                    label="Year"
                    options={yearOptions}
                    value={yearDisplay}
                    onSelect={setDobYear}
                    style={{ zIndex: 30 }}
                  />
                </View>
                {dobComplete && !dobValid ? (
                  <Text style={styles.dobError}>
                    You must be 16+ to create an account
                  </Text>
                ) : (
                  <Text style={styles.dobHelper}>
                    You must be 16+ to create an account
                  </Text>
                )}
              </View>

              {/* Password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholderTextColor={colors.text.muted}
                    placeholder="Create a password"
                    returnKeyType="go"
                    onSubmitEditing={handleRegister}
                  />
                  <TouchableOpacity
                    style={styles.eyeToggle}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.eyeIcon}>
                      {showPassword ? '\u{1F441}' : '\u25CF'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Error */}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* Create Account button */}
              <TouchableOpacity
                style={[
                  styles.button,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={colors.text.inverse} />
                ) : (
                  <Text style={styles.buttonText}>Create Account</Text>
                )}
              </TouchableOpacity>

              {/* Sign in link */}
              <View style={styles.signInRow}>
                <Text style={styles.signInText}>
                  Already have an account?
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                >
                  <Text style={styles.signInLink}> Sign in</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
    position: 'relative',
  },
  gradientTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GRADIENT_TOP,
  },
  gradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    backgroundColor: GRADIENT_BOTTOM,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 32,
    paddingHorizontal: 24,
  },

  // Logo
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.md, // 10px
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: colors.text.inverse,
    fontSize: 28,
    fontWeight: '700',
  },

  // Heading
  headingContainer: {
    alignItems: 'center',
    marginTop: spacing['2xl'], // 24px gap from logo
    gap: 6,
  },
  heading: {
    fontSize: fontSize['2xl'], // 24px
    fontWeight: '600',
    color: colors.text.primary,
  },
  subheading: {
    fontSize: 14,
    color: colors.text.secondary,
  },

  // Form
  form: {
    marginTop: spacing['2xl'], // 24px gap
    width: '100%',
    gap: 14,
  },
  fieldGroup: {
    width: '100%',
  },
  label: {
    fontSize: fontSize.sm, // 13px
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    borderRadius: radius.sm, // 6px
    height: 48,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text.primary,
  },

  // DOB row
  dobRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dobHelper: {
    fontSize: fontSize.xs, // 11px
    color: colors.text.muted,
    marginTop: 4,
  },
  dobError: {
    fontSize: fontSize.xs,
    color: colors.accent.error,
    marginTop: 4,
  },

  // Password
  passwordWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeToggle: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    color: colors.text.muted,
    fontSize: 18,
  },

  // Error
  error: {
    color: colors.accent.error,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },

  // Button
  button: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.sm, // 6px
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.text.inverse,
    fontSize: fontSize.md,
    fontWeight: '600',
  },

  // Sign in link
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing['3xl'],
    gap: 4,
  },
  signInText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },
  signInLink: {
    fontSize: fontSize.sm,
    color: colors.brand.primary,
    fontWeight: '500',
  },
});
