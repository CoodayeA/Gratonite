import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { events as eventsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { ScheduledEvent } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ScheduledEvents'>;

export default function ScheduledEventsScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId } = route.params;
  const [eventList, setEventList] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await eventsApi.list(guildId);
      setEventList(data);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load events');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  const handleRSVP = async (event: ScheduledEvent) => {
    try {
      if (event.isInterested) {
        await eventsApi.removeInterested(guildId, event.id);
        setEventList((prev) =>
          prev.map((e) =>
            e.id === event.id
              ? { ...e, isInterested: false, interestedCount: e.interestedCount - 1 }
              : e,
          ),
        );
      } else {
        await eventsApi.markInterested(guildId, event.id);
        setEventList((prev) =>
          prev.map((e) =>
            e.id === event.id
              ? { ...e, isInterested: true, interestedCount: e.interestedCount + 1 }
              : e,
          ),
        );
      }
    } catch {
      toast.error('Failed to update RSVP');
    }
  };

  const renderEvent = ({ item }: { item: ScheduledEvent }) => {
    const startDate = new Date(item.startTime);
    const isPast = startDate < new Date();

    return (
      <TouchableOpacity
        style={[styles.eventCard, isPast && styles.eventCardPast]}
        onPress={() => navigation.navigate('EventDetail', { guildId, eventId: item.id })}
      >
        <View style={styles.dateBox}>
          <Text style={styles.dateMonth}>
            {startDate.toLocaleDateString([], { month: 'short' }).toUpperCase()}
          </Text>
          <Text style={styles.dateDay}>{startDate.getDate()}</Text>
        </View>
        <View style={styles.eventInfo}>
          <Text style={styles.eventName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.eventTime}>{formatTime(item.startTime)}</Text>
          {item.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={colors.textMuted} />
              <Text style={styles.locationText} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
          )}
          <View style={styles.interestedRow}>
            <Ionicons name="people-outline" size={14} color={colors.textMuted} />
            <Text style={styles.interestedText}>
              {item.interestedCount} interested
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.rsvpButton, item.isInterested && styles.rsvpButtonActive]}
          onPress={() => handleRSVP(item)}
        >
          <Ionicons
            name={item.isInterested ? 'star' : 'star-outline'}
            size={18}
            color={item.isInterested ? colors.warning : colors.textSecondary}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    list: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    eventCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    eventCardPast: {
      opacity: 0.6,
    },
    dateBox: {
      width: 48,
      alignItems: 'center',
      backgroundColor: colors.accentLight,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm,
    },
    dateMonth: {
      color: colors.accentPrimary,
      fontSize: fontSize.xs,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    dateDay: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: '700',
    },
    eventInfo: {
      flex: 1,
    },
    eventName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
      marginBottom: 2,
    },
    eventTime: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      marginBottom: spacing.xs,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    locationText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      flex: 1,
    },
    interestedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    interestedText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    rsvpButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.bgHover,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rsvpButtonActive: {
      backgroundColor: 'rgba(250, 166, 26, 0.15)',
    },
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={eventList}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="No events"
            subtitle="Schedule an event to bring your community together"
            actionLabel="Create Event"
            onAction={() => navigation.navigate('EventCreate', { guildId })}
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('EventCreate', { guildId })}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}
