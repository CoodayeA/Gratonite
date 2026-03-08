import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, useNeo, spacing, fontSize, borderRadius } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lightImpact } from '../lib/haptics';

export interface ActionSheetItem {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  items: ActionSheetItem[];
}

export default function ActionSheet({ visible, onClose, title, items }: ActionSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const neo = useNeo();

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
      paddingBottom: 30,
      ...(neo ? { borderWidth: 3, borderColor: colors.border, borderTopLeftRadius: 0, borderTopRightRadius: 0 } : {}),
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
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: spacing.md,
      paddingHorizontal: spacing.lg,
      ...(neo ? { fontWeight: '800', textTransform: 'uppercase' } : {}),
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
      fontWeight: neo ? '700' : '500',
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
      ...(neo ? { borderRadius: 0, borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    cancelText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, neo]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          {title && <Text style={styles.title}>{title}</Text>}
          {items.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={styles.item}
              onPress={() => {
                lightImpact();
                item.onPress();
                onClose();
              }}
            >
              {item.icon && (
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={item.destructive ? colors.error : colors.textPrimary}
                />
              )}
              <Text style={[styles.label, item.destructive && styles.destructive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
