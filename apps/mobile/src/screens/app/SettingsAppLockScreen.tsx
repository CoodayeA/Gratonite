import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Switch, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appLockStore } from '../../lib/appLockStore';
import { useTheme } from '../../lib/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'SettingsAppLock'>;

export default function SettingsAppLockScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const isOn = await appLockStore.isEnabled();
      const type = await appLockStore.getBiometricType();
      setEnabled(isOn);
      setBiometricType(type);
      setLoading(false);
    })();
  }, []);

  const handleToggle = async (value: boolean) => {
    // Authenticate first
    const authed = await appLockStore.authenticate();
    if (!authed) {
      Alert.alert('Authentication Required', 'Please authenticate to change this setting.');
      return;
    }
    const success = await appLockStore.setEnabled(value);
    if (!success) {
      Alert.alert('Not Available', 'Biometric authentication is not set up on this device.');
      return;
    }
    setEnabled(value);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      padding: spacing.lg,
    },
    section: {
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      gap: spacing.lg,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rowInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flex: 1,
    },
    label: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    description: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: spacing.sm,
    },
    biometricType: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      marginTop: spacing.md,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return null;

  return (
    <PatternBackground>
      <View style={styles.section}>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Ionicons name="finger-print-outline" size={24} color={colors.accentPrimary} />
            <Text style={styles.label}>Require {biometricType} Unlock</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
          />
        </View>
        <Text style={styles.description}>
          When enabled, you'll need to use {biometricType} to open the app after being away for 30 seconds.
        </Text>
        <Text style={styles.biometricType}>
          Detected: {biometricType}
        </Text>
      </View>
    </PatternBackground>
  );
}
