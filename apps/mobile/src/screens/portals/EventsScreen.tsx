import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<any>;

interface ScheduledEvent {
  id: string;
  guildId: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  entityType: 'STAGE' | 'VOICE' | 'EXTERNAL';
  location?: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  interestedCount: number;
}

export function EventsScreen() {
  const navigation = useNavigation<Nav>();
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'active' | 'past'>('upcoming');

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return colors.accent.success;
      case 'SCHEDULED': return colors.accent.warning;
      case 'COMPLETED': return colors.text.muted;
      case 'CANCELLED': return colors.accent.error;
      default: return colors.text.secondary;
    }
  };

  const renderEvent = ({ item }: { item: ScheduledEvent }) => (
    <TouchableOpacity style={styles.eventCard}>
      <View style={styles.eventInfo}>
        <View style={styles.eventHeader}>
          <Text style={[styles.eventStatus, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
        <Text style={styles.eventName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.eventDesc} numberOfLines={2}>{item.description}</Text>
        )}
        <View style={styles.eventMeta}>
          <Text style={styles.eventTime}>🕐 {formatDate(item.startTime)}</Text>
          {item.location && <Text style={styles.eventLocation}>📍 {item.location}</Text>}
        </View>
        <Text style={styles.eventInterested}>👍 {item.interestedCount} interested</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Events</Text>
        <TouchableOpacity style={styles.createBtn}>
          <Text style={styles.createBtnText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        {(['upcoming', 'active', 'past'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
            <ActivityIndicator size="large" color={colors.brand.primary} />
      ) : (
        <FlatList
          data={events}
          renderItem={renderEvent}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No events</Text>
              <Text style={styles.emptyDesc}>No {filter} events scheduled</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  title: { fontSize: 28, fontWeight: '700', color: colors.text.primary },
  createBtn: { backgroundColor: colors.brand.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  createBtnText: { color: colors.bg.primary, fontWeight: '600' },
  filters: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  filterBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.stroke.primary },
  filterBtnActive: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  filterBtnText: { color: colors.text.secondary, textTransform: 'capitalize' },
  filterBtnTextActive: { color: colors.bg.primary },
  list: { padding: spacing.md },
  eventCard: { backgroundColor: colors.bg.secondary, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  eventInfo: { flex: 1 },
  eventHeader: { flexDirection: 'row', marginBottom: spacing.xs },
  eventStatus: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  eventName: { fontSize: 17, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.xs },
  eventDesc: { fontSize: 14, color: colors.text.secondary, marginBottom: spacing.sm },
  eventMeta: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xs },
  eventTime: { fontSize: 13, color: colors.text.muted },
  eventLocation: { fontSize: 13, color: colors.text.muted },
  eventInterested: { fontSize: 13, color: colors.text.muted },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.xs },
  emptyDesc: { fontSize: 14, color: colors.text.muted },
});
