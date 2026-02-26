import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<any>;
type RouteProps = RouteProp<{ params: { guildId: string } }, 'params'>;

interface StageInstance {
  id: string;
  channelId: string;
  channelName: string;
  topic: string;
  speakers: Array<{ id: string; name: string; avatar?: string }>;
  listeners: number;
  status: 'live' | 'scheduled';
  scheduledStart?: string;
}

export function StageScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { guildId } = route.params;
  const [stages, setStages] = useState<StageInstance[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    async function fetchStages() {
      if (!guildId) return;
      try {
        const res = await fetch(`/api/v1/guilds/${guildId}/stages`, { credentials: 'include' });
        const data = await res.json();
        setStages(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchStages();
  }, [guildId]);

  const joinStage = async (stageId: string) => {
    try {
      await fetch(`/api/v1/stages/${stageId}/join`, { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error(e);
    }
  };

  const renderStage = ({ item }: { item: StageInstance }) => (
    <View style={styles.stageCard}>
      <View style={styles.stageInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.channelName}>#{item.channelName}</Text>
          <View style={[styles.statusBadge, item.status === 'live' ? styles.liveBadge : styles.scheduledBadge]}>
            <Text style={[styles.statusText, item.status === 'live' && styles.liveText]}>
              {item.status === 'live' ? '🔴 LIVE' : '📅 Scheduled'}
            </Text>
          </View>
        </View>
        <Text style={styles.topic}>{item.topic}</Text>
      </View>
      {item.speakers.length > 0 && (
        <View style={styles.speakersSection}>
          <Text style={styles.speakersLabel}>Speakers</Text>
          <View style={styles.speakersRow}>
            {item.speakers.map((speaker) => (
              <View key={speaker.id} style={styles.speakerItem}>
                <View style={styles.speakerAvatar}><Text style={styles.speakerInitial}>{speaker.name.charAt(0)}</Text></View>
                <Text style={styles.speakerName} numberOfLines={1}>{speaker.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <View style={styles.stageFooter}>
        <Text style={styles.listenerCount}>👂 {item.listeners} listening</Text>
        <TouchableOpacity style={styles.joinBtn} onPress={() => joinStage(item.id)}>
          <Text style={styles.joinText}>Join</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Stages</Text>
      </View>
      <FlatList
        data={stages}
        renderItem={renderStage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No active stages</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.stroke.primary },
  headerTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text.primary },
  list: { padding: spacing.md },
  stageCard: { backgroundColor: colors.bg.secondary, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  stageInfo: { marginBottom: spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  channelName: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text.primary },
  topic: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: 2 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, marginTop: spacing.sm },
  liveBadge: { backgroundColor: colors.accent.error + '20' },
  scheduledBadge: { backgroundColor: colors.text.muted + '20' },
  statusText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.text.muted },
  liveText: { color: colors.accent.error },
  speakersSection: { marginTop: spacing.sm },
  speakersLabel: { fontSize: fontSize.xs, color: colors.text.muted, marginBottom: spacing.xs },
  speakersRow: { flexDirection: 'row', gap: spacing.sm },
  speakerItem: { alignItems: 'center', width: 60 },
  speakerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand.primary + '30', justifyContent: 'center', alignItems: 'center' },
  speakerInitial: { color: colors.brand.primary, fontWeight: '700' },
  speakerName: { fontSize: fontSize.xs, color: colors.text.primary, marginTop: 4, textAlign: 'center' },
  stageFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.stroke.primary },
  listenerCount: { fontSize: fontSize.sm, color: colors.text.muted },
  joinBtn: { backgroundColor: colors.brand.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  joinText: { color: colors.bg.primary, fontWeight: '600' },
  emptyText: { color: colors.text.muted, textAlign: 'center', marginTop: spacing.xl },
});
