/**
 * FederationScreen — Browse remote guilds and manage federation on mobile.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { apiFetch } from '../../lib/api';
import PressableScale from '../../components/PressableScale';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Federation'>;

interface RemoteGuild {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  iconUrl: string | null;
  instance: { baseUrl: string; trustLevel: string };
}

export default function FederationScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const [guilds, setGuilds] = useState<RemoteGuild[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGuilds();
  }, []);

  const loadGuilds = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<RemoteGuild[]>('/federation/discover/remote-guilds?limit=50');
      setGuilds(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const trustColor = (level: string) => {
    switch (level) {
      case 'verified': return '#22c55e';
      case 'manually_trusted': return '#3b82f6';
      default: return colors.textSecondary;
    }
  };

  const renderGuild = ({ item }: { item: RemoteGuild }) => (
    <PressableScale style={[styles.guildCard, { backgroundColor: colors.bgElevated, borderRadius: borderRadius.lg }]}>
      <View style={styles.guildHeader}>
        <View style={[styles.guildIcon, { backgroundColor: colors.accentPrimary + '20', borderRadius: borderRadius.md }]}>
          <Text style={{ color: colors.accentPrimary, fontWeight: '700', fontSize: fontSize.lg }}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: fontSize.md }} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <View style={[styles.badge, { backgroundColor: trustColor(item.instance.trustLevel) + '20' }]}>
              <Text style={{ color: trustColor(item.instance.trustLevel), fontSize: 10, fontWeight: '600' }}>
                {(() => { try { return new URL(item.instance.baseUrl).hostname; } catch { return item.instance.baseUrl; } })()}
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.xs }}>
              {item.memberCount.toLocaleString()} members
            </Text>
          </View>
        </View>
      </View>
      {item.description && (
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 8 }} numberOfLines={2}>
          {item.description}
        </Text>
      )}
    </PressableScale>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={[styles.header, { padding: spacing.md }]}>
        <Ionicons name="globe-outline" size={24} color={colors.accentPrimary} />
        <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: fontSize.lg, marginLeft: 8 }}>
          Federation
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accentPrimary} size="large" style={{ marginTop: 40 }} />
      ) : guilds.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="planet-outline" size={48} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: fontSize.md, textAlign: 'center' }}>
            No federated servers found.{'\n'}Check back later or ask your admin to enable federation.
          </Text>
        </View>
      ) : (
        <FlatList
          data={guilds}
          keyExtractor={item => item.id}
          renderItem={renderGuild}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  guildCard: { padding: 16 },
  guildHeader: { flexDirection: 'row', alignItems: 'center' },
  guildIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
});
