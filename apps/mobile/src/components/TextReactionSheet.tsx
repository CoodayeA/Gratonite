import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useTheme } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lightImpact } from '../lib/haptics';

interface TextReactionSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

export default function TextReactionSheet({ visible, onClose, onSubmit }: TextReactionSheetProps) {
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) {
      lightImpact();
      bottomSheetRef.current?.present();
      setText('');
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  }, [text, onSubmit, onClose]);

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
    charCount: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textAlign: 'right',
      paddingHorizontal: spacing.xl,
    },
    reactBtn: {
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
    reactBtnDisabled: {
      opacity: 0.5,
    },
    reactBtnText: {
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
        <Text style={styles.title}>Text Reaction</Text>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={(t) => setText(t.slice(0, 20))}
          placeholder="Type a reaction..."
          placeholderTextColor={colors.textMuted}
          maxLength={20}
          autoFocus
        />

        <Text style={styles.charCount}>{text.length}/20</Text>

        <TouchableOpacity
          style={[styles.reactBtn, !text.trim() && styles.reactBtnDisabled]}
          onPress={handleSubmit}
          disabled={!text.trim()}
        >
          <Ionicons name="text-outline" size={20} color={colors.white} />
          <Text style={styles.reactBtnText}>React</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
