import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { reminders as remindersApi } from '../lib/api';
import { useTheme } from '../lib/theme';
import { useToast } from '../contexts/ToastContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lightImpact } from '../lib/haptics';
import type { Message } from '../types';

interface ReminderSheetProps {
  visible: boolean;
  onClose: () => void;
  message: Message;
  channelId: string;
}

const QUICK_OPTIONS = [
  { label: 'In 30 minutes', minutes: 30, icon: 'time-outline' as const },
  { label: 'In 1 hour', minutes: 60, icon: 'time-outline' as const },
  { label: 'In 3 hours', minutes: 180, icon: 'time-outline' as const },
  { label: 'Tomorrow morning', minutes: -1, icon: 'sunny-outline' as const },
];

function getTomorrowMorning(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export default function ReminderSheet({ visible, onClose, message, channelId }: ReminderSheetProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      lightImpact();
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleSelect = useCallback(async (minutes: number) => {
    const remindAt = minutes === -1
      ? getTomorrowMorning().toISOString()
      : new Date(Date.now() + minutes * 60000).toISOString();

    try {
      await remindersApi.create({
        channelId,
        messageId: message.id,
        content: message.content,
        remindAt,
      });
      toast.success('Reminder set!');
    } catch {
      toast.error('Failed to set reminder');
    }
    onClose();
  }, [channelId, message, onClose, toast]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    [],
  );

  const styles = useMemo(() => StyleSheet.create({
    sheet: {
      backgroundColor: colors.bgSecondary,
      paddingBottom: insets.bottom + spacing.md,
    },
    handle: {
      backgroundColor: colors.bgSecondary,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    handleIndicator: {
      backgroundColor: colors.textMuted,
      width: 36,
    },
    title: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    label: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    cancelBtn: {
      marginTop: spacing.sm,
      paddingVertical: spacing.lg,
      marginHorizontal: spacing.lg,
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    cancelText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo, insets]);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      enableDynamicSizing
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      handleStyle={styles.handle}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={{ backgroundColor: colors.bgSecondary }}
    >
      <BottomSheetView style={styles.sheet}>
        <Text style={styles.title}>Remind Me</Text>

        {QUICK_OPTIONS.map((opt) => (
          <TouchableOpacity key={opt.label} style={styles.item} onPress={() => handleSelect(opt.minutes)}>
            <Ionicons name={opt.icon} size={22} color={colors.textPrimary} />
            <Text style={styles.label}>{opt.label}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
