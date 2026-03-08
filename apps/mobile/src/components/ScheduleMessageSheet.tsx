import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { scheduledMessages } from '../lib/api';
import { useTheme } from '../lib/theme';
import { useToast } from '../contexts/ToastContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lightImpact } from '../lib/haptics';

interface ScheduleMessageSheetProps {
  visible: boolean;
  onClose: () => void;
  channelId: string;
  content: string;
}

export default function ScheduleMessageSheet({ visible, onClose, channelId, content }: ScheduleMessageSheetProps) {
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [dateTime, setDateTime] = useState('');

  useEffect(() => {
    if (visible) {
      lightImpact();
      bottomSheetRef.current?.present();
      setDateTime('');
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleSchedule = useCallback(async () => {
    if (!dateTime.trim()) {
      toast.error('Please enter a date and time');
      return;
    }
    const parsed = new Date(dateTime.trim().replace(' ', 'T'));
    if (isNaN(parsed.getTime())) {
      toast.error('Invalid date format. Use YYYY-MM-DD HH:mm');
      return;
    }
    try {
      await scheduledMessages.create(channelId, content, parsed.toISOString());
      toast.success('Message scheduled!');
      onClose();
    } catch {
      toast.error('Failed to schedule message');
    }
  }, [channelId, content, dateTime, onClose, toast]);

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
    preview: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
    },
    previewLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginBottom: spacing.xs,
    },
    previewText: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: colors.textPrimary,
      marginHorizontal: spacing.xl,
      marginVertical: spacing.sm,
    },
    scheduleBtn: {
      backgroundColor: colors.accentPrimary,
      marginHorizontal: spacing.xl,
      marginTop: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    scheduleBtnText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
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
  }), [colors, spacing, fontSize, borderRadius, insets]);

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
        <Text style={styles.title}>Schedule Message</Text>

        <View style={styles.preview}>
          <Text style={styles.previewLabel}>Message</Text>
          <Text style={styles.previewText} numberOfLines={3}>{content}</Text>
        </View>

        <TextInput
          style={styles.input}
          value={dateTime}
          onChangeText={setDateTime}
          placeholder="YYYY-MM-DD HH:mm"
          placeholderTextColor={colors.textMuted}
          autoFocus
        />

        <TouchableOpacity style={styles.scheduleBtn} onPress={handleSchedule}>
          <Ionicons name="time-outline" size={20} color={colors.white} />
          <Text style={styles.scheduleBtnText}>Schedule</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
