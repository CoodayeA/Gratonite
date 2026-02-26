import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<any>;
type RouteProps = RouteProp<{ params: { guildId: string } }, 'params'>;

interface AnalyticsData {
  messagesToday: number;
  messagesThisWeek: number;
  messagesThisMonth: number;
  activeMembersToday: number;
  activeMembersThisWeek: number;
  activeMembersThisMonth: number;
  newMembersToday: number;
  newMembersThisWeek: number;
  newMembersThisMonth: number;
  topChannels: Array<{ channelId: string; channelName: string; messageCount: number }>;
}

export function AnalyticsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { guildId } = route.params;
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');

  React.useEffect(() => {
    async function fetchAnalytics() {
      if (!guildId) return;
      try {
        const res = await fetch(`/api/v1/guilds/${guildId}/analytics?period=${period}`, { credentials: 'include' });
        const data = await res.json();
        setAnalytics(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [guildId, period]);

  const StatCard = ({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) => (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
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
        <Text style={styles.headerTitle}>Analytics</Text>
      </View>
      <View style={styles.filters}>
        {(['day', 'week', 'month'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.filterBtn, period === p && styles.filterBtnActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.filterText, period === p && styles.filterTextActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {analytics && (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Messages</Text>
                <View style={styles.statsGrid}>
                  <StatCard title="Today" value={analytics.messagesToday} />
                  <StatCard title="This Week" value={analytics.messagesThisWeek} />
                  <StatCard title="This Month" value={analytics.messagesThisMonth} />
                </View>
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Active Members</Text>
                <View style={styles.statsGrid}>
                  <StatCard title="Today" value={analytics.activeMembersToday} />
                  <StatCard title="This Week" value={analytics.activeMembersThisWeek} />
                  <StatCard title="This Month" value={analytics.activeMembersThisMonth} />
                </View>
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Member Growth</Text>
                <View style={styles.statsGrid}>
                  <StatCard title="Joined Today" value={analytics.newMembersToday} subtitle="new" />
                  <StatCard title="This Week" value={analytics.newMembersThisWeek} />
                  <StatCard title="This Month" value={analytics.newMembersThisMonth} />
                </View>
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Channels</Text>
                {analytics.topChannels.slice(0, 5).map((channel, i) => (
                  <View key={channel.channelId} style={styles.channelRow}>
                    <Text style={styles.channelRank}>#{i + 1}</Text>
                    <Text style={styles.channelName}>{channel.channelName}</Text>
                    <Text style={styles.channelCount}>{channel.messageCount}</Text>
                  </View>
                ))}
              </View>
            </>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.stroke.primary },
  headerTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text.primary },
  filters: { flexDirection: 'row', padding: spacing.sm, gap: spacing.sm },
  filterBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.bg.secondary },
  filterBtnActive: { backgroundColor: colors.brand.primary },
  filterText: { color: colors.text.secondary, fontWeight: '500' },
  filterTextActive: { color: colors.text.primary },
  section: { padding: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: colors.bg.secondary, borderRadius: radius.lg, padding: spacing.md },
  statTitle: { fontSize: fontSize.sm, color: colors.text.muted, marginBottom: 4 },
  statValue: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text.primary },
  statSubtitle: { fontSize: fontSize.xs, color: colors.text.muted },
  channelRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, backgroundColor: colors.bg.secondary, borderRadius: radius.sm, marginBottom: spacing.xs },
  channelRank: { width: 30, color: colors.text.muted, fontSize: fontSize.sm },
  channelName: { flex: 1, color: colors.text.primary },
  channelCount: { color: colors.brand.primary, fontWeight: '600' },
});
