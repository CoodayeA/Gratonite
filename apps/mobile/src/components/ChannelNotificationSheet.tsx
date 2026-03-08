import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { channelOverrides } from '../lib/api';
import { useTheme } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChannelNotificationSheetProps {
  visible: boolean;
  onClose: () => void;
  channelId: string;
  currentLevel?: 'all' | 'mentions' | 'none' | null;
}

const LEVELS: Array<{ value: 'all' | 'mentions' | 'none'; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'all', label: 'All Messages', description: 'Get notified for every message', icon: 'notifications' },
  { value: 'mentions', label: '@Mentions Only', description: 'Only when you are mentioned', icon: 'at' },
  { value: 'none', label: 'Nothing', description: 'Mute all notifications', icon: 'notifications-off' },
];

export default function ChannelNotificationSheet({ visible, onClose, channelId, currentLevel }: ChannelNotificationSheetProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(currentLevel || null);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (level: 'all' | 'mentions' | 'none') => {
    setSaving(true);
    try {
      await channelOverrides.set(channelId, level);
      setSelected(level);
    } catch {
      // ignore
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await channelOverrides.delete(channelId);
      setSelected(null);
    } catch {
      // ignore
    } finally {
      setSaving(false);
      onClose();
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
      paddingBottom: insets.bottom + spacing.md,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: colors.textMuted,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    title: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '600',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    optionSelected: {
      backgroundColor: colors.accentLight,
    },
    optionInfo: {
      flex: 1,
    },
    optionLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    optionDesc: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: 2,
    },
    resetBtn: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      marginTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    resetText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: '500',
    },
  }), [colors, spacing, fontSize, borderRadius, neo, insets]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <Text style={styles.title}>Notification Settings</Text>

          {LEVELS.map((level) => (
            <TouchableOpacity
              key={level.value}
              style={[styles.option, selected === level.value && styles.optionSelected]}
              onPress={() => handleSelect(level.value)}
              disabled={saving}
            >
              <Ionicons name={level.icon} size={22} color={selected === level.value ? colors.accentPrimary : colors.textSecondary} />
              <View style={styles.optionInfo}>
                <Text style={styles.optionLabel}>{level.label}</Text>
                <Text style={styles.optionDesc}>{level.description}</Text>
              </View>
              {selected === level.value && (
                <Ionicons name="checkmark" size={22} color={colors.accentPrimary} />
              )}
            </TouchableOpacity>
          ))}

          {selected && (
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset} disabled={saving}>
              <Text style={styles.resetText}>Reset to Default</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
