import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../lib/theme';
import type { PresenceStatus } from '../types';

interface StatusOption {
  value: PresenceStatus;
  label: string;
  color: string;
  description: string;
}

interface StatusPickerProps {
  visible: boolean;
  onClose: () => void;
  currentStatus: PresenceStatus;
}

export default function StatusPicker({ visible, onClose, currentStatus }: StatusPickerProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();

  const STATUS_OPTIONS: StatusOption[] = [
  { value: 'online', label: 'Online', color: colors.online, description: 'You are visible to others' },
  { value: 'idle', label: 'Idle', color: colors.idle, description: 'You may be away' },
  { value: 'dnd', label: 'Do Not Disturb', color: colors.dnd, description: 'Suppress all notifications' },
  { value: 'invisible', label: 'Invisible', color: colors.offline, description: 'Appear offline to others' },
];
  const { updateStatus } = useAuth();

  const handleSelect = async (status: PresenceStatus) => {
    try {
      await updateStatus(status);
    } catch {
      // silently fail
    }
    onClose();
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bgSecondary,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingBottom: spacing.xxxl,
      paddingTop: spacing.md,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textMuted,
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.textPrimary,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      gap: spacing.md,
    },
    optionRowSelected: {
      backgroundColor: colors.accentLight,
    },
    statusDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    optionInfo: {
      flex: 1,
    },
    optionLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    optionDescription: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: 1,
    },
    checkmark: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkmarkText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Set Status</Text>

          {STATUS_OPTIONS.map((option) => {
            const isSelected = currentStatus === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                onPress={() => handleSelect(option.value)}
                activeOpacity={0.6}
              >
                <View style={[styles.statusDot, { backgroundColor: option.color }]} />
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                {isSelected && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
