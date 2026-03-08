import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useTheme } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lightImpact } from '../lib/haptics';
import type { Message } from '../types';

interface MessageContextMenuProps {
  visible: boolean;
  onClose: () => void;
  message: Message;
  isOwn: boolean;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onPin: (message: Message) => void;
  onUnpin: (message: Message) => void;
  onReact: (message: Message) => void;
  onBookmark: (message: Message) => void;
  onForward: (message: Message) => void;
}

export default function MessageContextMenu({
  visible,
  onClose,
  message,
  isOwn,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onReact,
  onBookmark,
  onForward,
}: MessageContextMenuProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      lightImpact();
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleAction = useCallback((action: (msg: Message) => void) => {
    action(message);
    onClose();
  }, [message, onClose]);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(message.content);
    onClose();
  }, [message, onClose]);

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
    destructive: {
      color: colors.error,
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
        <TouchableOpacity style={styles.item} onPress={() => handleAction(onReply)}>
          <Ionicons name="chatbubble-outline" size={22} color={colors.textPrimary} />
          <Text style={styles.label}>Reply</Text>
        </TouchableOpacity>

        {isOwn && (
          <TouchableOpacity style={styles.item} onPress={() => handleAction(onEdit)}>
            <Ionicons name="pencil-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.label}>Edit</Text>
          </TouchableOpacity>
        )}

        {isOwn && (
          <TouchableOpacity style={styles.item} onPress={() => handleAction(onDelete)}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
            <Text style={[styles.label, styles.destructive]}>Delete</Text>
          </TouchableOpacity>
        )}

        {message.pinned ? (
          <TouchableOpacity style={styles.item} onPress={() => handleAction(onUnpin)}>
            <Ionicons name="pin" size={22} color={colors.textPrimary} />
            <Text style={styles.label}>Unpin</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.item} onPress={() => handleAction(onPin)}>
            <Ionicons name="pin-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.label}>Pin</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.item} onPress={handleCopy}>
          <Ionicons name="copy-outline" size={22} color={colors.textPrimary} />
          <Text style={styles.label}>Copy Text</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.item} onPress={() => handleAction(onReact)}>
          <Ionicons name="happy-outline" size={22} color={colors.textPrimary} />
          <Text style={styles.label}>React</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.item} onPress={() => handleAction(onBookmark)}>
          <Ionicons name="bookmark-outline" size={22} color={colors.textPrimary} />
          <Text style={styles.label}>Bookmark</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.item} onPress={() => handleAction(onForward)}>
          <Ionicons name="arrow-redo-outline" size={22} color={colors.textPrimary} />
          <Text style={styles.label}>Forward</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
