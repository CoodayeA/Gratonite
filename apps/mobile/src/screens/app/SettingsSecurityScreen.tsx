import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { securityStore } from '../../lib/securityStore';
import { loadKeyPairFromSecureStore, clearKeyPairFromSecureStore, exportPublicKey } from '../../lib/crypto';
import { publicKeyCache } from '../../lib/publicKeyCache';
import { getFingerprint } from '../../lib/keyVerification';
import * as ScreenCapture from 'expo-screen-capture';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'SettingsSecurity'>;

export default function SettingsSecurityScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const toast = useToast();
  const [screenshotProtection, setScreenshotProtection] = useState(false);
  const [incognitoKeyboard, setIncognitoKeyboard] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [hasKeys, setHasKeys] = useState(false);

  useEffect(() => {
    (async () => {
      setScreenshotProtection(await securityStore.getScreenshotProtection());
      setIncognitoKeyboard(await securityStore.getIncognitoKeyboard());
      const kp = await loadKeyPairFromSecureStore();
      if (kp) {
        setHasKeys(true);
        const pubJwk = await exportPublicKey(kp.publicKey);
        const fp = await getFingerprint(pubJwk);
        setFingerprint(fp.slice(0, 32).match(/.{1,4}/g)?.join(':') ?? fp.slice(0, 32));
      }
    })();
  }, []);

  const handleScreenshotToggle = async (val: boolean) => {
    setScreenshotProtection(val);
    await securityStore.setScreenshotProtection(val);
    if (val) {
      ScreenCapture.preventScreenCaptureAsync();
    } else {
      ScreenCapture.allowScreenCaptureAsync();
    }
    toast.success(val ? 'Screenshot protection enabled' : 'Screenshot protection disabled');
  };

  const handleIncognitoToggle = async (val: boolean) => {
    setIncognitoKeyboard(val);
    await securityStore.setIncognitoKeyboard(val);
    toast.success(val ? 'Incognito keyboard enabled' : 'Incognito keyboard disabled');
  };

  const handleClearKeys = () => {
    Alert.alert(
      'Clear Encryption Keys',
      'This will remove your encryption keys. You will generate new keys on next login. Existing encrypted messages may become unreadable.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearKeyPairFromSecureStore();
            publicKeyCache.clearAll();
            setHasKeys(false);
            setFingerprint(null);
            toast.success('Encryption keys cleared');
          },
        },
      ],
    );
  };

  const handleCopyFingerprint = async () => {
    if (fingerprint) {
      await Clipboard.setStringAsync(fingerprint);
      toast.success('Fingerprint copied to clipboard');
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    section: {
      marginTop: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowIcon: {
      marginRight: spacing.md,
    },
    rowContent: {
      flex: 1,
    },
    rowLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    rowSublabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
    statusCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    statusText: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    fingerprintText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontFamily: 'monospace',
      marginTop: spacing.xs,
    },
    destructiveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.bgElevated,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.md,
      marginTop: spacing.md,
    },
    destructiveBtnText: {
      color: colors.error,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius]);

  return (
    <PatternBackground>
    <ScrollView style={{ flex: 1 }}>
      {/* Encryption Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ENCRYPTION</Text>
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Ionicons
              name={hasKeys ? 'shield-checkmark' : 'shield-outline'}
              size={22}
              color={hasKeys ? colors.success : colors.textMuted}
            />
            <Text style={styles.statusText}>
              End-to-End Encryption: {hasKeys ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
          {fingerprint && (
            <TouchableOpacity onPress={handleCopyFingerprint}>
              <Text style={styles.fingerprintText}>{fingerprint}</Text>
              <Text style={[styles.rowSublabel, { marginTop: spacing.xs }]}>Tap to copy</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Privacy Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PRIVACY</Text>
        <View style={styles.row}>
          <Ionicons name="camera-outline" size={22} color={colors.textSecondary} style={styles.rowIcon} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Screenshot Protection</Text>
            <Text style={styles.rowSublabel}>Prevent screen captures in the app</Text>
          </View>
          <Switch
            value={screenshotProtection}
            onValueChange={handleScreenshotToggle}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
          />
        </View>
        <View style={styles.row}>
          <Ionicons name="eye-off-outline" size={22} color={colors.textSecondary} style={styles.rowIcon} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Incognito Keyboard</Text>
            <Text style={styles.rowSublabel}>Disable autocorrect and spell check in chat</Text>
          </View>
          <Switch
            value={incognitoKeyboard}
            onValueChange={handleIncognitoToggle}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
          />
        </View>
      </View>

      {/* Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DATA</Text>
        {hasKeys && (
          <TouchableOpacity style={styles.destructiveBtn} onPress={handleClearKeys}>
            <Ionicons name="key-outline" size={20} color={colors.error} />
            <Text style={styles.destructiveBtnText}>Clear Encryption Keys</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
    </PatternBackground>
  );
}
