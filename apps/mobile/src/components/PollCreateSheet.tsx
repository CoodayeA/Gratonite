import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { polls as pollsApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PollCreateSheetProps {
  visible: boolean;
  onClose: () => void;
  channelId: string;
}

const DURATION_OPTIONS: { label: string; value: number }[] = [
  { label: '1 hour', value: 3600 },
  { label: '6 hours', value: 21600 },
  { label: '1 day', value: 86400 },
  { label: '3 days', value: 259200 },
  { label: '7 days', value: 604800 },
];

export default function PollCreateSheet({ visible, onClose, channelId }: PollCreateSheetProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [duration, setDuration] = useState(86400);
  const [multiSelect, setMultiSelect] = useState(false);
  const [creating, setCreating] = useState(false);

  const resetForm = () => {
    setQuestion('');
    setOptions(['', '']);
    setDuration(86400);
    setMultiSelect(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const addOption = () => {
    if (options.length >= 10) return;
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, text: string) => {
    const updated = [...options];
    updated[index] = text;
    setOptions(updated);
  };

  const canCreate =
    question.trim().length > 0 &&
    options.filter((o) => o.trim().length > 0).length >= 2;

  const handleCreate = async () => {
    if (!canCreate || creating) return;

    setCreating(true);
    try {
      const filteredOptions = options
        .map((o) => o.trim())
        .filter((o) => o.length > 0);

      await pollsApi.create(channelId, {
        question: question.trim(),
        options: filteredOptions,
        duration,
        multiselect: multiSelect,
      });
      handleClose();
    } catch {
      toast.error('Failed to create poll');
    } finally {
      setCreating(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: colors.bgSecondary,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '85%',
      paddingBottom: 30,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: colors.textMuted,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '600',
    },
    body: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
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
      marginBottom: spacing.lg,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    optionInput: {
      flex: 1,
      backgroundColor: colors.inputBg,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    removeOptionBtn: {
      padding: spacing.xs,
    },
    addOptionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    addOptionText: {
      color: colors.accentPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    durationRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    durationChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    durationChipActive: {
      backgroundColor: colors.accentLight,
      borderColor: colors.accentPrimary,
    },
    durationText: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    durationTextActive: {
      color: colors.accentPrimary,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      marginBottom: spacing.lg,
    },
    switchLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
    },
    createButton: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    createButtonDisabled: {
      opacity: 0.5,
    },
    createButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <Text style={styles.title}>Create Poll</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Question */}
            <Text style={styles.fieldLabel}>Question</Text>
            <TextInput
              style={styles.fieldInput}
              value={question}
              onChangeText={setQuestion}
              placeholder="Ask a question..."
              placeholderTextColor={colors.textMuted}
              maxLength={300}
            />

            {/* Options */}
            <Text style={styles.fieldLabel}>Options</Text>
            {options.map((opt, index) => (
              <View key={index} style={styles.optionRow}>
                <TextInput
                  style={styles.optionInput}
                  value={opt}
                  onChangeText={(text) => updateOption(index, text)}
                  placeholder={`Option ${index + 1}`}
                  placeholderTextColor={colors.textMuted}
                  maxLength={100}
                />
                {options.length > 2 && (
                  <TouchableOpacity
                    style={styles.removeOptionBtn}
                    onPress={() => removeOption(index)}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {options.length < 10 && (
              <TouchableOpacity style={styles.addOptionBtn} onPress={addOption}>
                <Ionicons name="add" size={18} color={colors.accentPrimary} />
                <Text style={styles.addOptionText}>Add Option</Text>
              </TouchableOpacity>
            )}

            {/* Duration */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Duration</Text>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  style={[
                    styles.durationChip,
                    duration === d.value && styles.durationChipActive,
                  ]}
                  onPress={() => setDuration(d.value)}
                >
                  <Text
                    style={[
                      styles.durationText,
                      duration === d.value && styles.durationTextActive,
                    ]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Multi-select */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Allow multiple selections</Text>
              <Switch
                value={multiSelect}
                onValueChange={setMultiSelect}
                trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
                thumbColor={colors.white}
              />
            </View>

            {/* Create button */}
            <TouchableOpacity
              style={[styles.createButton, (!canCreate || creating) && styles.createButtonDisabled]}
              onPress={handleCreate}
              disabled={!canCreate || creating}
            >
              <Text style={styles.createButtonText}>
                {creating ? 'Creating...' : 'Create Poll'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
