import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { connections } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { mediumImpact } from '../../lib/haptics';
import LoadingScreen from '../../components/LoadingScreen';
import type { SocialConnection } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Connections'>;

/** Brand colors for third-party providers — intentionally not theme-dependent */
const PROVIDER_BRAND_COLORS = {
  twitch: '#9146ff',
  steam: '#1b2838',
  twitter: '#1da1f2',
  youtube: '#ff0000',
} as const;

const PROVIDERS_BASE = [
  { id: 'github', name: 'GitHub', icon: 'logo-github', brandColor: null },
  { id: 'twitch', name: 'Twitch', icon: 'logo-twitch', brandColor: PROVIDER_BRAND_COLORS.twitch },
  { id: 'steam', name: 'Steam', icon: 'game-controller-outline', brandColor: PROVIDER_BRAND_COLORS.steam },
  { id: 'twitter', name: 'Twitter', icon: 'logo-twitter', brandColor: PROVIDER_BRAND_COLORS.twitter },
  { id: 'youtube', name: 'YouTube', icon: 'logo-youtube', brandColor: PROVIDER_BRAND_COLORS.youtube },
];

export default function ConnectionsScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();

  const PROVIDERS = useMemo(() => PROVIDERS_BASE.map(p => ({
    ...p,
    color: p.brandColor ?? colors.bgElevated,
  })), [colors.bgElevated]);

  const [linked, setLinked] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConnections = useCallback(async () => {
    try {
      const data = await connections.list();
      setLinked(data);
    } catch {
      toast.error('Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const handleConnect = (provider: string) => {
    mediumImpact();
    const providerName = PROVIDERS.find(p => p.id === provider)?.name ?? provider;
    Alert.prompt(
      `Connect ${providerName}`,
      `Enter your ${providerName} username:`,
      async (username) => {
        if (!username?.trim()) return;
        try {
          await connections.add({ provider, providerUsername: username.trim() });
          toast.success(`${providerName} connected!`);
          fetchConnections();
        } catch {
          toast.error(`Failed to connect ${providerName}`);
        }
      },
      'plain-text',
      '',
      'default',
    );
  };

  const handleDisconnect = (conn: SocialConnection) => {
    Alert.alert('Disconnect', `Remove ${conn.providerUsername} from ${conn.provider}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive', onPress: async () => {
          try {
            await connections.remove(conn.provider);
            toast.success('Disconnected');
            fetchConnections();
          } catch {
            toast.error('Failed to disconnect');
          }
        }
      }
    ]);
  };

  const getProvider = (id: string) => PROVIDERS.find(p => p.id === id);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    section: { padding: spacing.lg },
    sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.md },
    providerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgElevated, borderRadius: neo ? 0 : borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, gap: spacing.md, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    providerInfo: { flex: 1 },
    providerName: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
    providerUsername: { fontSize: fontSize.sm, color: colors.textSecondary },
    connectBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: neo ? 0 : borderRadius.full, backgroundColor: colors.accentPrimary },
    connectBtnText: { color: colors.white, fontWeight: '600', fontSize: fontSize.sm },
    disconnectBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: neo ? 0 : borderRadius.full, backgroundColor: colors.error + '20' },
    disconnectBtnText: { color: colors.error, fontWeight: '600', fontSize: fontSize.sm },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    verifiedText: { fontSize: fontSize.xs, color: colors.success },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  const linkedProviders = new Set(linked.map(c => c.provider));

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connected Accounts</Text>
        {PROVIDERS.map(provider => {
          const conn = linked.find(c => c.provider === provider.id);
          return (
            <View key={provider.id} style={styles.providerRow}>
              <Ionicons name={provider.icon as any} size={28} color={provider.color} />
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{provider.name}</Text>
                {conn ? (
                  <>
                    <Text style={styles.providerUsername}>{conn.providerUsername}</Text>
                  </>
                ) : (
                  <Text style={styles.providerUsername}>Not connected</Text>
                )}
              </View>
              {conn ? (
                <TouchableOpacity style={styles.disconnectBtn} onPress={() => handleDisconnect(conn)}>
                  <Text style={styles.disconnectBtnText}>Remove</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.connectBtn} onPress={() => handleConnect(provider.id)}>
                  <Text style={styles.connectBtnText}>Connect</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
