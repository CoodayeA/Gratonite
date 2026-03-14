import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { timeline as timelineApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import LoadErrorCard from '../../components/LoadErrorCard';
import type { TimelineEvent } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'TimelineChannel'>;

const EVENT_TYPES = ['milestone', 'event', 'message', 'update', 'release'] as const;
type EventType = (typeof EVENT_TYPES)[number];

const TYPE_LABELS: Record<EventType, string> = {
  milestone: 'Milestone',
  event: 'Event',
  message: 'Message',
  update: 'Update',
  release: 'Release',
};

function getTypeIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'milestone': return 'star';
    case 'event': return 'flag';
    case 'message': return 'chatbubble';
    case 'update': return 'arrow-up-circle';
    case 'release': return 'rocket';
    default: return 'ellipse';
  }
}

function getTypeColor(type: string, colors: any): string {
  switch (type) {
    case 'milestone': return colors.warning;
    case 'event': return colors.accentPrimary;
    case 'message': return colors.success;
    case 'update': return '#9b59b6';
    case 'release': return '#e74c3c';
    default: return colors.textMuted;
  }
}

export default function TimelineChannelScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { channelId, channelName } = route.params;
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // New event modal
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState<EventType>('milestone');
  const [creating, setCreating] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await timelineApi.list(channelId);
      setEvents(data);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load timeline';
        if (refreshing || events.length > 0) {
          toast.error(message);
        } else {
          setLoadError(message);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [channelId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleCreateEvent = async () => {
    const title = newTitle.trim();
    if (!title) {
      toast.error('Title is required');
      return;
    }

    setCreating(true);
    try {
      const event = await timelineApi.create(channelId, {
        title,
        description: newDescription.trim() || undefined,
        eventDate: newDate.trim() || new Date().toISOString(),
        type: newType,
      });
      setEvents((prev) => [event, ...prev]);
      setShowNewEvent(false);
      setNewTitle('');
      setNewDescription('');
      setNewDate('');
      setNewType('milestone');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  const renderEvent = ({ item, index }: { item: TimelineEvent; index: number }) => {
    const typeColor = getTypeColor(item.type, colors);
    const isLast = index === events.length - 1;

    return (
      <View style={styles.eventRow}>
        {/* Timeline line + icon */}
        <View style={styles.timelineColumn}>
          <View style={[styles.iconCircle, { backgroundColor: typeColor }]}>
            <Ionicons name={getTypeIcon(item.type)} size={14} color={colors.white} />
          </View>
          {!isLast && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
        </View>

        {/* Content */}
        <View style={styles.eventContent}>
          <Text style={styles.eventTitle}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.eventDescription} numberOfLines={3}>{item.description}</Text>
          ) : null}
          <View style={styles.eventMeta}>
            <Text style={styles.eventDate}>{formatRelativeTime(item.eventDate)}</Text>
            {item.authorName ? (
              <>
                <Text style={styles.eventDot}>{'\u00B7'}</Text>
                <Text style={styles.eventAuthor}>{item.authorName}</Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    listContent: {
      padding: spacing.md,
      paddingBottom: 80,
    },
    eventRow: {
      flexDirection: 'row',
    },
    timelineColumn: {
      width: 40,
      alignItems: 'center',
    },
    iconCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    },
    timelineLine: {
      width: 2,
      flex: 1,
      marginTop: -2,
    },
    eventContent: {
      flex: 1,
      marginLeft: spacing.md,
      marginBottom: spacing.xl,
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    eventTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    eventDescription: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 20,
      marginBottom: spacing.sm,
    },
    eventMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    eventDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    eventDot: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    eventAuthor: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    fab: {
      position: 'absolute',
      right: spacing.xl,
      bottom: spacing.xl,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.bgPrimary,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      maxHeight: '90%',
      flex: 1,
      marginTop: 60,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '700',
      flex: 1,
      textAlign: 'center',
      marginHorizontal: spacing.md,
    },
    postButton: {
      color: colors.accentPrimary,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    postButtonDisabled: {
      color: colors.textMuted,
    },
    formScrollContent: {
      padding: spacing.lg,
      gap: spacing.lg,
    },
    inputLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    textInput: {
      backgroundColor: colors.inputBg,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    typeChip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeChipActive: {
      backgroundColor: colors.accentPrimary,
      borderColor: colors.accentPrimary,
    },
    typeChipText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    typeChipTextActive: {
      color: colors.white,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  if (loadError && events.length === 0) return <LoadErrorCard title="Failed to load timeline" message={loadError} onRetry={() => { setLoading(true); fetchEvents(); }} />;

  return (
    <PatternBackground>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchEvents(); }}
            tintColor={colors.accentPrimary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title="No timeline events"
            subtitle="Add the first event to start building your timeline!"
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowNewEvent(true)}
        accessibilityLabel="Create event"
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* New Event Modal */}
      <Modal visible={showNewEvent} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowNewEvent(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New Event</Text>
              <TouchableOpacity
                onPress={handleCreateEvent}
                disabled={creating || !newTitle.trim()}
              >
                <Text
                  style={[
                    styles.postButton,
                    (!newTitle.trim() || creating) && styles.postButtonDisabled,
                  ]}
                >
                  {creating ? 'Adding...' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formScrollContent}>
              <View>
                <Text style={styles.inputLabel}>Title</Text>
                <TextInput
                  style={styles.textInput}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="Event title"
                  placeholderTextColor={colors.textMuted}
                  maxLength={200}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Description (optional)</Text>
                <TextInput
                  style={[styles.textInput, { minHeight: 100 }]}
                  value={newDescription}
                  onChangeText={setNewDescription}
                  placeholder="What happened?"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={2000}
                  textAlignVertical="top"
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Date (optional, YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  value={newDate}
                  onChangeText={setNewDate}
                  placeholder="2026-03-07"
                  placeholderTextColor={colors.textMuted}
                  maxLength={10}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Type</Text>
                <View style={styles.typeRow}>
                  {EVENT_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeChip, newType === t && styles.typeChipActive]}
                      onPress={() => setNewType(t)}
                    >
                      <Text
                        style={[styles.typeChipText, newType === t && styles.typeChipTextActive]}
                      >
                        {TYPE_LABELS[t]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </PatternBackground>
  );
}
