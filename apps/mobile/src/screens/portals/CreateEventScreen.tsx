import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { PortalsStackParamList } from '../../navigation/types';
import { eventsApi, channelsApi } from '../../lib/api';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<PortalsStackParamList, 'CreateEvent'>;
type Route = RouteProp<PortalsStackParamList, 'CreateEvent'>;

type EntityType = 'voice' | 'stage_instance' | 'external';

const ENTITY_TYPES: { value: EntityType; label: string; icon: keyof typeof Ionicons.glyphMap; description: string }[] = [
  { value: 'voice', label: 'Voice Channel', icon: 'volume-high-outline', description: 'Host in a voice channel' },
  { value: 'stage_instance', label: 'Stage', icon: 'mic-outline', description: 'Host a stage event' },
  { value: 'external', label: 'External', icon: 'location-outline', description: 'Somewhere else' },
];

// ── Step Indicator ────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={stepStyles.container}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            stepStyles.dot,
            i < current ? stepStyles.dotCompleted : null,
            i === current ? stepStyles.dotActive : null,
          ]}
        />
      ))}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.stroke.primary,
  },
  dotActive: {
    backgroundColor: colors.brand.primary,
    width: 24,
    borderRadius: 4,
  },
  dotCompleted: {
    backgroundColor: colors.brand.primary,
  },
});

// ── Main Screen ──────────────────────────────────────────────
export function CreateEventScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { guildId } = route.params;

  // Wizard step: 0 = type, 1 = details, 2 = preview
  const [step, setStep] = useState(0);

  // Step 1: Event type + channel
  const [entityType, setEntityType] = useState<EntityType>('voice');
  const [channelId, setChannelId] = useState('');
  const [channels, setChannels] = useState<any[]>([]);
  const [channelsLoaded, setChannelsLoaded] = useState(false);

  // Step 2: Details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');

  // Submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Load channels when entering step 1 ─────────────────
  const loadChannels = useCallback(async () => {
    if (channelsLoaded) return;
    try {
      const result = await channelsApi.getGuildChannels(guildId);
      setChannels(result.filter((c: any) => c.type === 'voice' || c.type === 'stage'));
      setChannelsLoaded(true);
    } catch {
      // Channels will remain empty; user can still proceed
    }
  }, [guildId, channelsLoaded]);

  // ── Navigation handlers ────────────────────────────────
  const goNext = () => {
    if (step === 0) {
      if (entityType !== 'external' && !channelId && channels.length > 0) {
        setError('Please select a channel');
        return;
      }
      loadChannels();
    }
    if (step === 1) {
      if (!title.trim()) {
        setError('Event title is required');
        return;
      }
      if (!startDate || !startTime) {
        setError('Start date and time are required');
        return;
      }
    }
    setError('');
    setStep((s) => Math.min(s + 1, 2));
  };

  const goBack = () => {
    if (step > 0) {
      setError('');
      setStep((s) => s - 1);
    } else {
      navigation.goBack();
    }
  };

  // ── Submit ─────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const scheduledStartTime = new Date(`${startDate}T${startTime}:00`).toISOString();
      const scheduledEndTime =
        endDate && endTime
          ? new Date(`${endDate}T${endTime}:00`).toISOString()
          : undefined;

      await eventsApi.create(guildId, {
        name: title.trim(),
        description: description.trim() || undefined,
        scheduledStartTime,
        scheduledEndTime,
        entityType,
        channelId: entityType !== 'external' ? channelId : undefined,
        entityMetadata:
          entityType === 'external' && location.trim()
            ? { location: location.trim() }
            : undefined,
      });

      Alert.alert('Event Created', 'Your event has been scheduled.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  // ── Load channels on mount ─────────────────────────────
  React.useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // ── Render step content ────────────────────────────────
  const renderStep0 = () => (
    <>
      <Text style={styles.sectionTitle}>Event Type</Text>
      <View style={styles.typeGrid}>
        {ENTITY_TYPES.map((et) => (
          <TouchableOpacity
            key={et.value}
            style={[styles.typeCard, entityType === et.value && styles.typeCardActive]}
            onPress={() => {
              setEntityType(et.value);
              setError('');
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={et.icon}
              size={28}
              color={entityType === et.value ? colors.brand.primary : colors.text.secondary}
            />
            <Text style={[styles.typeLabel, entityType === et.value && styles.typeLabelActive]}>
              {et.label}
            </Text>
            <Text style={styles.typeDescription}>{et.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {entityType !== 'external' && channels.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Channel</Text>
          <View style={styles.channelList}>
            {channels.map((ch: any) => (
              <TouchableOpacity
                key={ch.id}
                style={[styles.channelRow, channelId === ch.id && styles.channelRowActive]}
                onPress={() => {
                  setChannelId(ch.id);
                  setError('');
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={ch.type === 'voice' ? 'volume-high-outline' : 'mic-outline'}
                  size={18}
                  color={channelId === ch.id ? colors.brand.primary : colors.text.muted}
                />
                <Text
                  style={[
                    styles.channelName,
                    channelId === ch.id && styles.channelNameActive,
                  ]}
                >
                  {ch.name}
                </Text>
                {channelId === ch.id && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.brand.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </>
  );

  const renderStep1 = () => (
    <>
      <Text style={styles.sectionTitle}>Event Details</Text>

      {/* Title */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            setError('');
          }}
          placeholder="Give your event a name"
          placeholderTextColor={colors.text.muted}
          maxLength={100}
          returnKeyType="next"
        />
      </View>

      {/* Description */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="What is the event about?"
          placeholderTextColor={colors.text.muted}
          maxLength={1000}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Location (external only) */}
      {entityType === 'external' && (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Where will it happen?"
            placeholderTextColor={colors.text.muted}
            maxLength={100}
          />
        </View>
      )}

      {/* Start Date/Time */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Start Date & Time</Text>
        <View style={styles.dateTimeRow}>
          <TextInput
            style={[styles.input, styles.dateInput]}
            value={startDate}
            onChangeText={(v) => {
              setStartDate(v);
              setError('');
            }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.text.muted}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          <TextInput
            style={[styles.input, styles.timeInput]}
            value={startTime}
            onChangeText={(v) => {
              setStartTime(v);
              setError('');
            }}
            placeholder="HH:MM"
            placeholderTextColor={colors.text.muted}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </View>
      </View>

      {/* End Date/Time */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>End Date & Time (optional)</Text>
        <View style={styles.dateTimeRow}>
          <TextInput
            style={[styles.input, styles.dateInput]}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.text.muted}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          <TextInput
            style={[styles.input, styles.timeInput]}
            value={endTime}
            onChangeText={setEndTime}
            placeholder="HH:MM"
            placeholderTextColor={colors.text.muted}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </View>
      </View>
    </>
  );

  const selectedTypeMeta = ENTITY_TYPES.find((t) => t.value === entityType);
  const selectedChannel = channels.find((c: any) => c.id === channelId);

  const renderStep2 = () => (
    <>
      <Text style={styles.sectionTitle}>Preview & Confirm</Text>

      <View style={styles.previewCard}>
        {/* Type badge */}
        <View style={styles.previewBadge}>
          <Ionicons
            name={selectedTypeMeta?.icon ?? 'calendar-outline'}
            size={16}
            color={colors.brand.primary}
          />
          <Text style={styles.previewBadgeText}>{selectedTypeMeta?.label}</Text>
        </View>

        {/* Title */}
        <Text style={styles.previewTitle}>{title || 'Untitled Event'}</Text>

        {/* Description */}
        {description ? (
          <Text style={styles.previewDescription}>{description}</Text>
        ) : null}

        {/* Meta rows */}
        <View style={styles.previewMeta}>
          <View style={styles.previewMetaRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.text.muted} />
            <Text style={styles.previewMetaText}>
              {startDate} at {startTime}
              {endDate ? ` — ${endDate} at ${endTime}` : ''}
            </Text>
          </View>

          {entityType !== 'external' && selectedChannel && (
            <View style={styles.previewMetaRow}>
              <Ionicons name="volume-high-outline" size={16} color={colors.text.muted} />
              <Text style={styles.previewMetaText}>{selectedChannel.name}</Text>
            </View>
          )}

          {entityType === 'external' && location ? (
            <View style={styles.previewMetaRow}>
              <Ionicons name="location-outline" size={16} color={colors.text.muted} />
              <Text style={styles.previewMetaText}>{location}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 0 ? 'New Event' : step === 1 ? 'Details' : 'Confirm'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <StepIndicator current={step} total={3} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}

          {/* Error */}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom button */}
      <View style={styles.bottomBar}>
        {step < 2 ? (
          <TouchableOpacity style={styles.primaryButton} onPress={goNext} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.text.inverse} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.text.inverse} />
                <Text style={styles.primaryButtonText}>Create Event</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['4xl'],
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.secondary,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },

  // Sections
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },

  // Type selection
  typeGrid: {
    gap: spacing.md,
  },
  typeCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  typeCardActive: {
    borderColor: colors.brand.primary,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  typeLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  typeLabelActive: {
    color: colors.brand.primary,
  },
  typeDescription: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
  },

  // Channel selection
  channelList: {
    gap: spacing.xs,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  channelRowActive: {
    borderColor: colors.brand.primary,
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
  },
  channelName: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  channelNameActive: {
    color: colors.brand.primary,
    fontWeight: '600',
  },

  // Form fields
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: '#25243a',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateInput: {
    flex: 3,
  },
  timeInput: {
    flex: 2,
  },

  // Preview
  previewCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    padding: spacing.xl,
    gap: spacing.md,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  previewBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.brand.primary,
  },
  previewTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: colors.text.primary,
  },
  previewDescription: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  previewMeta: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewMetaText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },

  // Error
  error: {
    color: colors.accent.error,
    fontSize: fontSize.sm,
    marginTop: spacing.md,
    textAlign: 'center',
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.stroke.secondary,
  },
  primaryButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.sm,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryButtonText: {
    color: colors.text.inverse,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
