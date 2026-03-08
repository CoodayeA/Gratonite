import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useTheme } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lightImpact } from '../lib/haptics';

interface WhoReactedSheetProps {
  visible: boolean;
  onClose: () => void;
  users: Array<{ id: string; username?: string }>;
  emoji: string;
}

export default function WhoReactedSheet({ visible, onClose, users, emoji }: WhoReactedSheetProps) {
  const { colors, spacing, fontSize, borderRadius } = useTheme();
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
      maxHeight: 400,
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    emoji: {
      fontSize: fontSize.xxl,
    },
    count: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    username: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
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
        <View style={styles.header}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={styles.count}>{users.length}</Text>
        </View>

        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.userItem}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.username || item.id.slice(0, 2)).charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.username}>{item.username || item.id.slice(0, 8)}</Text>
            </View>
          )}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
