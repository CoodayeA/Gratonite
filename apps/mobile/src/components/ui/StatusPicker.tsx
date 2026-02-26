import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usersApi } from '../../lib/api';
import { colors, spacing, radius, fontSize } from '../../theme';

// ── Status definitions ───────────────────────────────────────
type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible';

const STATUS_OPTIONS: {
  value: PresenceStatus;
  label: string;
  description: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'online',
    label: 'Online',
    description: 'You are available',
    color: colors.status.online,
    icon: 'ellipse',
  },
  {
    value: 'idle',
    label: 'Idle',
    description: 'You may be away',
    color: colors.status.idle,
    icon: 'moon',
  },
  {
    value: 'dnd',
    label: 'Do Not Disturb',
    description: 'Suppress all notifications',
    color: colors.status.dnd,
    icon: 'remove-circle',
  },
  {
    value: 'invisible',
    label: 'Invisible',
    description: 'Appear offline to others',
    color: colors.status.offline,
    icon: 'eye-off',
  },
];

interface StatusPickerProps {
  visible: boolean;
  onClose: () => void;
  currentStatus?: PresenceStatus;
  onStatusChange?: (status: PresenceStatus) => void;
}

export function StatusPicker({
  visible,
  onClose,
  currentStatus = 'online',
  onStatusChange,
}: StatusPickerProps) {
  const [selected, setSelected] = useState<PresenceStatus>(currentStatus);
  const [customText, setCustomText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Save status ────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      await usersApi.updatePresence(selected);
      onStatusChange?.(selected);
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }, [selected, onStatusChange, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayDismiss} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Title */}
          <Text style={styles.title}>Set Status</Text>

          {/* Status options */}
          <View style={styles.optionsList}>
            {STATUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionRow,
                  selected === option.value && styles.optionRowActive,
                ]}
                onPress={() => {
                  setSelected(option.value);
                  setError('');
                }}
                activeOpacity={0.7}
              >
                {/* Status indicator */}
                <View style={[styles.statusDot, { backgroundColor: option.color }]}>
                  {option.value === 'dnd' && (
                    <View style={styles.dndLine} />
                  )}
                  {option.value === 'idle' && (
                    <View style={styles.idleCut} />
                  )}
                  {option.value === 'invisible' && (
                    <View style={styles.invisibleCenter} />
                  )}
                </View>

                {/* Label + description */}
                <View style={styles.optionTextContainer}>
                  <Text
                    style={[
                      styles.optionLabel,
                      selected === option.value && styles.optionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>

                {/* Checkmark */}
                {selected === option.value && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.brand.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom status text */}
          <View style={styles.customSection}>
            <Text style={styles.customLabel}>Custom Status</Text>
            <TextInput
              style={styles.customInput}
              value={customText}
              onChangeText={setCustomText}
              placeholder="What are you up to?"
              placeholderTextColor={colors.text.muted}
              maxLength={128}
              returnKeyType="done"
            />
          </View>

          {/* Error */}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.saveButtonText}>Save Status</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayDismiss: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
  },
  sheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing['4xl'],
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.stroke.primary,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text.primary,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },

  // Options
  optionsList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionRowActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
    borderColor: colors.brand.primary,
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dndLine: {
    width: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.bg.secondary,
  },
  idleCut: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg.secondary,
    position: 'absolute',
    top: -1,
    right: -1,
  },
  invisibleCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg.secondary,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  optionLabelActive: {
    color: colors.brand.primary,
  },
  optionDescription: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    marginTop: 1,
  },

  // Custom status
  customSection: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  customLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  customInput: {
    backgroundColor: '#25243a',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },

  // Error
  error: {
    color: colors.accent.error,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },

  // Save button
  saveButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.sm,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.text.inverse,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
