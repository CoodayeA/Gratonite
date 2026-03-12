import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { events as eventsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import type { ScheduledEvent } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'EventDetail'>;

export default function EventDetailScreen({ route }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId, eventId } = route.params;
  const [event, setEvent] = useState<ScheduledEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEvent = useCallback(async () => {
    try {
      const data = await eventsApi.get(guildId, eventId);
      setEvent(data);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load event');
      }
    } finally {
      setLoading(false);
    }
  }, [guildId, eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleToggleInterested = async () => {
    if (!event) return;

    try {
      if (event.isInterested) {
        await eventsApi.removeInterested(guildId, eventId);
        setEvent({
          ...event,
          isInterested: false,
          interestedCount: event.interestedCount - 1,
        });
      } else {
        await eventsApi.markInterested(guildId, eventId);
        setEvent({
          ...event,
          isInterested: true,
          interestedCount: event.interestedCount + 1,
        });
      }
    } catch {
      toast.error('Failed to update interest');
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    content: {
      padding: spacing.lg,
    },
    dateBanner: {
      alignItems: 'center',
      backgroundColor: colors.accentLight,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.xl,
      marginBottom: spacing.lg,
    },
    dateBannerMonth: {
      color: colors.accentPrimary,
      fontSize: fontSize.xs,
      fontWeight: '700',
      letterSpacing: 1,
    },
    dateBannerDay: {
      color: colors.textPrimary,
      fontSize: fontSize.xxxl,
      fontWeight: '700',
    },
    dateBannerYear: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
    eventName: {
      color: colors.textPrimary,
      fontSize: fontSize.xxl,
      fontWeight: '700',
      marginBottom: spacing.md,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.bgElevated,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      marginBottom: spacing.lg,
    },
    statusText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    detailsCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.lg,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    detailIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.bgHover,
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailContent: {
      flex: 1,
    },
    detailLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    detailValue: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
    },
    descriptionCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
    },
    descriptionLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    descriptionText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      lineHeight: 24,
    },
    interestedButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.lg,
      gap: spacing.sm,
    },
    interestedButtonActive: {
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    interestedButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    interestedButtonTextActive: {
      color: colors.warning,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading || !event) {
    return <LoadingScreen />;
  }

  const startDate = new Date(event.startTime);
  const isPast = startDate < new Date();

  return (
    <PatternBackground>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* Date banner */}
      <View style={styles.dateBanner}>
        <Text style={styles.dateBannerMonth}>
          {startDate.toLocaleDateString([], { month: 'long' }).toUpperCase()}
        </Text>
        <Text style={styles.dateBannerDay}>{startDate.getDate()}</Text>
        <Text style={styles.dateBannerYear}>{startDate.getFullYear()}</Text>
      </View>

      {/* Event name */}
      <Text style={styles.eventName}>{event.name}</Text>

      {/* Status badge */}
      {isPast && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Event ended</Text>
        </View>
      )}

      {/* Details card */}
      <View style={styles.detailsCard}>
        {/* Start time */}
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="time-outline" size={20} color={colors.accentPrimary} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Start</Text>
            <Text style={styles.detailValue}>{formatTime(event.startTime)}</Text>
          </View>
        </View>

        {/* End time */}
        {event.endTime && (
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="time-outline" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>End</Text>
              <Text style={styles.detailValue}>{formatTime(event.endTime)}</Text>
            </View>
          </View>
        )}

        {/* Location */}
        {event.location && (
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="location-outline" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>{event.location}</Text>
            </View>
          </View>
        )}

        {/* Creator */}
        {event.creatorName && (
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Created by</Text>
              <Text style={styles.detailValue}>{event.creatorName}</Text>
            </View>
          </View>
        )}

        {/* Interested count */}
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="people-outline" size={20} color={colors.textMuted} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Interested</Text>
            <Text style={styles.detailValue}>{event.interestedCount} people</Text>
          </View>
        </View>
      </View>

      {/* Description */}
      {event.description && (
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionLabel}>Description</Text>
          <Text style={styles.descriptionText}>{event.description}</Text>
        </View>
      )}

      {/* Interested toggle */}
      <TouchableOpacity
        style={[
          styles.interestedButton,
          event.isInterested && styles.interestedButtonActive,
        ]}
        onPress={handleToggleInterested}
      >
        <Ionicons
          name={event.isInterested ? 'star' : 'star-outline'}
          size={20}
          color={event.isInterested ? colors.warning : colors.white}
        />
        <Text
          style={[
            styles.interestedButtonText,
            event.isInterested && styles.interestedButtonTextActive,
          ]}
        >
          {event.isInterested ? 'Interested' : 'Mark as Interested'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
    </PatternBackground>
  );
}
