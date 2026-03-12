import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { events as eventsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'EventCreate'>;

export default function EventCreateScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId, eventId } = route.params;
  const isEditing = Boolean(eventId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);

  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    try {
      const event = await eventsApi.get(guildId, eventId);
      setName(event.name);
      setDescription(event.description || '');
      setLocation(event.location || '');

      const start = new Date(event.startTime);
      setStartDate(start.toISOString().split('T')[0]);
      setStartTime(start.toTimeString().slice(0, 5));

      if (event.endTime) {
        const end = new Date(event.endTime);
        setEndDate(end.toISOString().split('T')[0]);
        setEndTime(end.toTimeString().slice(0, 5));
      }
    } catch {
      toast.error('Failed to load event');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [guildId, eventId, navigation]);

  useEffect(() => {
    if (isEditing) {
      fetchEvent();
    }
  }, [isEditing, fetchEvent]);

  const canSave = name.trim().length > 0 && startDate.length > 0 && startTime.length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;

    const startDateTime = `${startDate}T${startTime}:00.000Z`;
    const endDateTime = endDate && endTime ? `${endDate}T${endTime}:00.000Z` : undefined;

    setSaving(true);
    try {
      if (isEditing && eventId) {
        await eventsApi.update(guildId, eventId, {
          name: name.trim(),
          description: description.trim() || undefined,
          startTime: startDateTime,
          endTime: endDateTime,
          location: location.trim() || undefined,
        });
      } else {
        await eventsApi.create(guildId, {
          name: name.trim(),
          description: description.trim() || undefined,
          startTime: startDateTime,
          endTime: endDateTime,
          location: location.trim() || undefined,
        });
      }
      navigation.goBack();
    } catch {
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} event`);
    } finally {
      setSaving(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    fieldInput: {
      backgroundColor: colors.inputBg,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    multilineInput: {
      minHeight: 100,
      paddingTop: spacing.md,
    },
    saveButton: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.xl,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <PatternBackground>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* Name */}
      <Text style={styles.fieldLabel}>Event Name *</Text>
      <TextInput
        style={styles.fieldInput}
        value={name}
        onChangeText={setName}
        placeholder="What's the event?"
        placeholderTextColor={colors.textMuted}
        maxLength={100}
      />

      {/* Description */}
      <Text style={styles.fieldLabel}>Description</Text>
      <TextInput
        style={[styles.fieldInput, styles.multilineInput]}
        value={description}
        onChangeText={setDescription}
        placeholder="Tell people what this event is about..."
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        maxLength={1000}
      />

      {/* Start date/time */}
      <Text style={styles.fieldLabel}>Start Date *</Text>
      <TextInput
        style={styles.fieldInput}
        value={startDate}
        onChangeText={setStartDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textMuted}
        maxLength={10}
        keyboardType="numbers-and-punctuation"
      />

      <Text style={styles.fieldLabel}>Start Time *</Text>
      <TextInput
        style={styles.fieldInput}
        value={startTime}
        onChangeText={setStartTime}
        placeholder="HH:MM (24h)"
        placeholderTextColor={colors.textMuted}
        maxLength={5}
        keyboardType="numbers-and-punctuation"
      />

      {/* End date/time */}
      <Text style={styles.fieldLabel}>End Date</Text>
      <TextInput
        style={styles.fieldInput}
        value={endDate}
        onChangeText={setEndDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textMuted}
        maxLength={10}
        keyboardType="numbers-and-punctuation"
      />

      <Text style={styles.fieldLabel}>End Time</Text>
      <TextInput
        style={styles.fieldInput}
        value={endTime}
        onChangeText={setEndTime}
        placeholder="HH:MM (24h)"
        placeholderTextColor={colors.textMuted}
        maxLength={5}
        keyboardType="numbers-and-punctuation"
      />

      {/* Location */}
      <Text style={styles.fieldLabel}>Location</Text>
      <TextInput
        style={styles.fieldInput}
        value={location}
        onChangeText={setLocation}
        placeholder="Where is this event?"
        placeholderTextColor={colors.textMuted}
        maxLength={200}
      />

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveButton, (!canSave || saving) && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!canSave || saving}
      >
        <Text style={styles.saveButtonText}>
          {saving
            ? isEditing
              ? 'Saving...'
              : 'Creating...'
            : isEditing
              ? 'Save Changes'
              : 'Create Event'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
    </PatternBackground>
  );
}
