import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import LoadErrorCard from '../../components/LoadErrorCard';
import { loadKeyPairFromSecureStore, exportPublicKey } from '../../lib/crypto';
import { encryption as encryptionApi } from '../../lib/api';
import {
  getFingerprint,
  getFingerprintEmoji,
  compareFingerprints,
  markAsTrusted,
  isTrusted as checkIsTrusted,
} from '../../lib/keyVerification';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'KeyVerification'>;

export default function KeyVerificationScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [myFingerprint, setMyFingerprint] = useState<string | null>(null);
  const [myEmoji, setMyEmoji] = useState<string | null>(null);
  const [theirFingerprint, setTheirFingerprint] = useState<string | null>(null);
  const [theirEmoji, setTheirEmoji] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      setLoadError(null);
      const kp = await loadKeyPairFromSecureStore();
      if (kp) {
        const myJwk = await exportPublicKey(kp.publicKey);
        setMyFingerprint(await getFingerprint(myJwk));
        setMyEmoji(await getFingerprintEmoji(myJwk));
      }

      const res = await encryptionApi.getPublicKey(userId);
      if (res?.publicKeyJwk) {
        setTheirFingerprint(await getFingerprint(res.publicKeyJwk));
        setTheirEmoji(await getFingerprintEmoji(res.publicKeyJwk));
      }

      setVerified(await checkIsTrusted(userId));
    } catch {
      setLoadError('Failed to load keys');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleVerify = async () => {
    if (theirFingerprint) {
      await markAsTrusted(userId, theirFingerprint);
      setVerified(true);
      toast.success('Contact verified!');
    }
  };

  const handleCopyFingerprint = async (fp: string) => {
    await Clipboard.setStringAsync(fp);
    toast.success('Fingerprint copied');
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    section: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '700',
      letterSpacing: 1,
    },
    card: {
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    emojiGrid: {
      fontSize: fontSize.xxl,
      textAlign: 'center',
      letterSpacing: 4,
      paddingVertical: spacing.md,
    },
    fingerprintText: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontFamily: 'monospace',
      textAlign: 'center',
    },
    verifyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.accentPrimary,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.md,
      marginHorizontal: spacing.lg,
    },
    verifyBtnText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    verifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.bgElevated,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.md,
      marginHorizontal: spacing.lg,
    },
    verifiedText: {
      color: colors.success,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    hint: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
      lineHeight: 20,
    },
  }), [colors, spacing, fontSize, borderRadius]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  if (loadError && !myFingerprint && !theirFingerprint) {
    return <LoadErrorCard title="Failed to load keys" message={loadError} onRetry={fetchKeys} />;
  }

  return (
    <PatternBackground>
    <ScrollView style={{ flex: 1 }}>
      {/* My Key */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>YOUR KEY</Text>
        <TouchableOpacity style={styles.card} onPress={() => myFingerprint && handleCopyFingerprint(myFingerprint)}>
          <Text style={styles.cardTitle}>Your Key Fingerprint</Text>
          {myEmoji && <Text style={styles.emojiGrid}>{myEmoji}</Text>}
          {myFingerprint && (
            <Text style={styles.fingerprintText}>{myFingerprint.slice(0, 32)}...</Text>
          )}
          {!myFingerprint && (
            <Text style={styles.fingerprintText}>No encryption key found</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Their Key */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>THEIR KEY</Text>
        <TouchableOpacity style={styles.card} onPress={() => theirFingerprint && handleCopyFingerprint(theirFingerprint)}>
          <Text style={styles.cardTitle}>Contact's Key Fingerprint</Text>
          {theirEmoji && <Text style={styles.emojiGrid}>{theirEmoji}</Text>}
          {theirFingerprint && (
            <Text style={styles.fingerprintText}>{theirFingerprint.slice(0, 32)}...</Text>
          )}
          {!theirFingerprint && (
            <Text style={styles.fingerprintText}>Contact has no encryption key</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Verification */}
      <Text style={styles.hint}>
        Compare the emoji grids above with your contact in person or via a trusted channel. If they match, tap Verify to mark this contact as trusted.
      </Text>

      {theirFingerprint && (
        <View style={{ marginTop: spacing.lg, marginBottom: spacing.xxxl }}>
          {verified ? (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <Text style={styles.verifiedText}>Verified Contact</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.verifyBtn} onPress={handleVerify}>
              <Ionicons name="shield-checkmark" size={22} color={colors.white} />
              <Text style={styles.verifyBtnText}>Verify Contact</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
    </PatternBackground>
  );
}
