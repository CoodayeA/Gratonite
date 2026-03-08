import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../lib/theme';

interface CustomStatusInputProps {
  visible: boolean;
  onClose: () => void;
  currentStatus: string | null;
  onSave: (status: string | null) => void;
}

export default function CustomStatusInput({
  visible,
  onClose,
  currentStatus,
  onSave,
}: CustomStatusInputProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) {
      setText(currentStatus || '');
    }
  }, [visible, currentStatus]);

  const handleSave = () => {
    const trimmed = text.trim();
    onSave(trimmed.length > 0 ? trimmed : null);
    onClose();
  };

  const handleClear = () => {
    onSave(null);
    onClose();
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    keyboardView: {
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
      marginBottom: spacing.lg,
    },
    inputContainer: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xl,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    actions: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    clearButton: {
      flex: 1,
      backgroundColor: colors.bgElevated,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    clearButtonText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    saveButton: {
      flex: 1,
      backgroundColor: colors.accentPrimary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    saveButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.title}>Set Custom Status</Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder="What are you up to?"
                placeholderTextColor={colors.textMuted}
                maxLength={128}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClear}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
