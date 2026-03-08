import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useTheme } from '../lib/theme';
import { lightImpact } from '../lib/haptics';
import { channels as channelsApi } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

interface DisappearSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  channelId: string;
  currentTimer: number | null;
  onTimerChanged: (timer: number | null) => void;
}

const TIMER_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '30 seconds', value: 30 },
  { label: '5 minutes', value: 300 },
  { label: '1 hour', value: 3600 },
  { label: '24 hours', value: 86400 },
  { label: '7 days', value: 604800 },
];

export default function DisappearSettingsSheet({
  visible,
  onClose,
  channelId,
  currentTimer,
  onTimerChanged,
}: DisappearSettingsSheetProps) {
  const { colors, spacing, fontSize, borderRadius } = useTheme();
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

  const handleSelect = async (value: number) => {
    try {
      await channelsApi.setDisappearTimer(channelId, value || null);
      onTimerChanged(value || null);
      toast.success(value ? `Messages will disappear after ${TIMER_OPTIONS.find(o => o.value === value)?.label}` : 'Disappearing messages disabled');
    } catch {
      toast.error('Failed to update timer');
    }
    onClose();
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    [],
  );

  const styles = useMemo(() => StyleSheet.create({
    sheet: {
      backgroundColor: colors.bgSecondary,
      paddingBottom: spacing.xxxl,
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
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '700',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    optionLabel: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    activeLabel: {
      color: colors.accentPrimary,
    },
  }), [colors, spacing, fontSize]);

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
        <Text style={styles.title}>Disappearing Messages</Text>
        {TIMER_OPTIONS.map((opt) => {
          const isActive = (currentTimer ?? 0) === opt.value;
          return (
            <TouchableOpacity key={opt.value} style={styles.option} onPress={() => handleSelect(opt.value)}>
              <Text style={[styles.optionLabel, isActive && styles.activeLabel]}>{opt.label}</Text>
              {isActive && <Ionicons name="checkmark" size={22} color={colors.accentPrimary} />}
            </TouchableOpacity>
          );
        })}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
