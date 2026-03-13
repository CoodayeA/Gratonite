import React, { useEffect, useMemo } from 'react';
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

  const tryUnlock = async () => {
    const success = await appLockStore.authenticate();
    if (success) onUnlock();
  };

  useEffect(() => {
    tryUnlock();
  }, []);

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
        <Text style={styles.subtitle}>Use biometric authentication to access the app</Text>
        <TouchableOpacity style={styles.button} onPress={tryUnlock}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </PatternBackground>
  );
}
