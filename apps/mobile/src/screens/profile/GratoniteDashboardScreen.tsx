import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth.store';
import { apiFetch } from '../../lib/api';
import { colors, fontSize, spacing, radius } from '../../theme';

interface DashboardStats {
  portalsJoined: number;
  messagesSent: number;
  friendsCount: number;
  daysActive: number;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function GratoniteDashboardScreen() {
  const user = useAuthStore((s) => s.user);

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiFetch<DashboardStats>('/users/@me/stats'),
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>
            Hey, {user?.displayName ?? user?.username ?? 'there'}
          </Text>
          <Text style={styles.greetingSub}>
            Here&apos;s your Gratonite overview
          </Text>
        </View>

        {/* Stats grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>YOUR ACTIVITY</Text>
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={colors.brand.primary} />
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <StatCard label="Portals Joined" value={stats?.portalsJoined ?? 0} />
              <StatCard label="Messages Sent" value={stats?.messagesSent ?? 0} />
              <StatCard label="Friends" value={stats?.friendsCount ?? 0} />
              <StatCard label="Days Active" value={stats?.daysActive ?? 0} />
            </View>
          )}
        </View>

        {/* Account info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.card}>
            <View style={[styles.infoRow, styles.rowBorder]}>
              <Text style={styles.infoLabel}>Username</Text>
              <Text style={styles.infoValue}>{user?.username ?? '—'}</Text>
            </View>
            <View style={[styles.infoRow, styles.rowBorder]}>
              <Text style={styles.infoLabel}>Display Name</Text>
              <Text style={styles.infoValue}>{user?.displayName ?? '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email ?? '—'}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing['5xl'],
  },

  // Greeting
  greetingSection: {
    marginBottom: spacing['2xl'],
  },
  greeting: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  greetingSub: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },

  // Section
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    padding: spacing.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.brand.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.text.muted,
  },
  loadingWrap: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },

  // Card
  card: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.primary,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },
  infoValue: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.primary,
  },
});
