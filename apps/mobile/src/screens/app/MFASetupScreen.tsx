import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { mfa } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import SectionHeader from '../../components/SectionHeader';
import LoadingScreen from '../../components/LoadingScreen';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'MFASetup'>;

type Step = 'status' | 'secret' | 'verify' | 'backupCodes';

export default function MFASetupScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [step, setStep] = useState<Step>('status');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Disable fields
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const checkStatus = useCallback(async () => {
    try {
      const res = await mfa.status();
      setEnabled(res.enabled);
    } catch (err: any) {
      toast.error(err.message || 'Failed to check MFA status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleStartSetup = async () => {
    setBusy(true);
    try {
      const res = await mfa.setupStart();
      setSecret(res.secret);
      setStep('secret');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start MFA setup');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }
    setBusy(true);
    try {
      const res = await mfa.enable(code);
      setBackupCodes(res.backupCodes);
      setEnabled(true);
      setStep('backupCodes');
      toast.success('Two-factor authentication enabled');
    } catch (err: any) {
      toast.error(err.message || 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (!disablePassword || disableCode.length !== 6) {
      toast.error('Please enter your password and a 6-digit code');
      return;
    }
    setBusy(true);
    try {
      await mfa.disable(disablePassword, disableCode);
      setEnabled(false);
      setDisablePassword('');
      setDisableCode('');
      toast.success('Two-factor authentication disabled');
    } catch (err: any) {
      toast.error(err.message || 'Failed to disable MFA');
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    await Clipboard.setStringAsync(secret);
    toast.success('Secret copied to clipboard');
  };

  const copyBackupCodes = async () => {
    await Clipboard.setStringAsync(backupCodes.join('\n'));
    toast.success('Backup codes copied');
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    section: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.bgSecondary,
      padding: spacing.lg,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md,
    },
    statusText: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.textPrimary,
      flex: 1,
    },
    badge: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
    },
    badgeEnabled: {
      backgroundColor: colors.success + '30',
    },
    badgeDisabled: {
      backgroundColor: colors.error + '30',
    },
    badgeText: {
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    button: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.sm,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border, shadowColor: neo.shadowColor, shadowOffset: neo.shadowOffset, shadowOpacity: neo.shadowOpacity, shadowRadius: neo.shadowRadius } : {}),
    },
    buttonDanger: {
      backgroundColor: colors.error,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    label: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: colors.textPrimary,
      marginBottom: spacing.md,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    secretBox: {
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    secretText: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.textPrimary,
      fontFamily: 'monospace',
      letterSpacing: 2,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    copyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    copyText: {
      color: colors.accentPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    infoText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 20,
      marginBottom: spacing.md,
    },
    codeItem: {
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.xs,
    },
    codeText: {
      fontFamily: 'monospace',
      fontSize: fontSize.md,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    bottomPad: {
      height: 40,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  return (
    <PatternBackground>
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
      {/* Status display */}
      <SectionHeader title="Two-Factor Authentication" />
      <View style={styles.section}>
        <View style={styles.statusBadge}>
          <Ionicons
            name={enabled ? 'shield-checkmark' : 'shield-outline'}
            size={24}
            color={enabled ? colors.success : colors.textMuted}
          />
          <Text style={styles.statusText}>Two-Factor Auth</Text>
          <View style={[styles.badge, enabled ? styles.badgeEnabled : styles.badgeDisabled]}>
            <Text style={[styles.badgeText, { color: enabled ? colors.success : colors.error }]}>
              {enabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </View>

        {/* Enabled: show disable form */}
        {enabled && step === 'status' && (
          <>
            <Text style={styles.infoText}>
              To disable two-factor authentication, enter your password and a code from your authenticator app.
            </Text>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={disablePassword}
              onChangeText={setDisablePassword}
              placeholder="Enter your password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
            <Text style={styles.label}>Authentication Code</Text>
            <TextInput
              style={styles.input}
              value={disableCode}
              onChangeText={setDisableCode}
              placeholder="6-digit code"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.button, styles.buttonDanger, busy && styles.buttonDisabled]}
              onPress={handleDisable}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Disable Two-Factor Auth</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Not enabled, status step: show enable button */}
        {!enabled && step === 'status' && (
          <>
            <Text style={styles.infoText}>
              Add an extra layer of security to your account by enabling two-factor authentication with an authenticator app.
            </Text>
            <TouchableOpacity
              style={[styles.button, busy && styles.buttonDisabled]}
              onPress={handleStartSetup}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Enable Two-Factor Auth</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Step 1: Show secret */}
        {step === 'secret' && (
          <>
            <Text style={styles.infoText}>
              Enter this secret key in your authenticator app (Google Authenticator, Authy, etc.):
            </Text>
            <View style={styles.secretBox}>
              <Text style={styles.secretText}>{secret}</Text>
              <TouchableOpacity style={styles.copyRow} onPress={copySecret}>
                <Ionicons name="copy-outline" size={16} color={colors.accentPrimary} />
                <Text style={styles.copyText}>Copy to clipboard</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.button}
              onPress={() => setStep('verify')}
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Step 2: Verify code */}
        {step === 'verify' && (
          <>
            <Text style={styles.infoText}>
              Enter the 6-digit code from your authenticator app to verify setup:
            </Text>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="6-digit code"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.button, busy && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Verify & Enable</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Step 3: Backup codes */}
        {step === 'backupCodes' && (
          <>
            <Text style={styles.infoText}>
              Save these backup codes in a safe place. Each code can be used once to sign in if you lose access to your authenticator app.
            </Text>
            {backupCodes.map((bc, i) => (
              <View key={i} style={styles.codeItem}>
                <Text style={styles.codeText}>{bc}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.copyRow} onPress={copyBackupCodes}>
              <Ionicons name="copy-outline" size={16} color={colors.accentPrimary} />
              <Text style={styles.copyText}>Copy all codes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { marginTop: spacing.lg }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.buttonText}>Done</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
    </PatternBackground>
  );
}
