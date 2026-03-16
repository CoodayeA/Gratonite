import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appLockStore } from '../../lib/appLockStore';
import { useTheme } from '../../lib/theme';
import PatternBackground from '../../components/PatternBackground';

interface AppLockScreenProps {
  onUnlock: () => void;
}

export default function AppLockScreen({ onUnlock }: AppLockScreenProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const [attempts, setAttempts] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const tryUnlock = useCallback(async (isAutoRetry = false) => {
    setErrorMsg(null);
    const result = await appLockStore.authenticate();

    if (!mountedRef.current) return;

    if (result.success) {
      onUnlock();
      return;
    }

    setAttempts(prev => prev + 1);

    if (result.userCanceled) {
      setErrorMsg('Authentication canceled');
      return;
    }

    setErrorMsg(result.error || 'Authentication failed');

    // Auto-retry once on non-cancel failure
    if (!isAutoRetry) {
      setTimeout(() => {
        if (mountedRef.current) tryUnlock(true);
      }, 500);
    }
  }, [onUnlock]);

  useEffect(() => {
    // Small delay to let the screen render before prompting
    const timer = setTimeout(() => {
      if (mountedRef.current) tryUnlock();
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tryUnlock]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.xl,
    },
    icon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    title: {
      fontSize: fontSize.xxl,
      fontWeight: neo ? '800' : '700',
      color: colors.textPrimary,
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.xxxl,
    },
    button: {
      backgroundColor: colors.accentPrimary,
      paddingHorizontal: spacing.xxxl,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.md,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border, shadowColor: neo.shadowColor, shadowOffset: neo.shadowOffset, shadowOpacity: neo.shadowOpacity, shadowRadius: neo.shadowRadius } : {}),
    },
    buttonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <PatternBackground>
      <View style={styles.container}>
        <View style={styles.icon}>
          <Ionicons name="lock-closed" size={36} color={colors.accentPrimary} />
        </View>
        <Text style={styles.title}>Unlock Gratonite</Text>
        <Text style={styles.subtitle}>
          {errorMsg
            ? errorMsg
            : 'Use biometric authentication to access the app'}
        </Text>
        {attempts >= 2 && (
          <Text style={[styles.subtitle, { fontSize: fontSize.sm, marginTop: -spacing.md }]}>
            Having trouble? Make sure biometrics are set up in your device settings.
          </Text>
        )}
        <TouchableOpacity style={styles.button} onPress={() => tryUnlock()}>
          <Text style={styles.buttonText}>{attempts > 0 ? 'Try Again' : 'Unlock'}</Text>
        </TouchableOpacity>
      </View>
    </PatternBackground>
  );
}
