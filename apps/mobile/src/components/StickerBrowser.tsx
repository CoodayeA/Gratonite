import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { stickers as stickersApi } from '../lib/api';
import { useTheme } from '../lib/theme';
import { lightImpact } from '../lib/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Sticker } from '../types';

interface StickerBrowserProps {
  visible: boolean;
  onClose: () => void;
  guildId: string;
  onSelect: (sticker: Sticker) => void;
}

export default function StickerBrowser({ visible, onClose, guildId, onSelect }: StickerBrowserProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const insets = useSafeAreaInsets();
  const [stickerList, setStickerList] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStickers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await stickersApi.listForGuild(guildId);
      setStickerList(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    if (visible) {
      fetchStickers();
    }
  }, [visible, fetchStickers]);

  const handleSelect = (sticker: Sticker) => {
    lightImpact();
    onSelect(sticker);
    onClose();
  };

  const renderSticker = ({ item }: { item: Sticker }) => (
    <TouchableOpacity style={styles.stickerItem} onPress={() => handleSelect(item)}>
      <Image
        source={{ uri: item.url }}
        style={styles.stickerImage}
        contentFit="contain"
        cachePolicy="memory-disk"
      />
      <Text style={styles.stickerName} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

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
      maxHeight: '60%',
      paddingBottom: 30,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: colors.textMuted,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '600',
    },
    loader: {
      paddingVertical: spacing.xxxl,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: spacing.xxxl,
      gap: spacing.sm,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: fontSize.lg,
      fontWeight: '600',
    },
    emptySubtext: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
    grid: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    gridRow: {
      justifyContent: 'flex-start',
      gap: spacing.sm,
    },
    stickerItem: {
      flex: 1,
      maxWidth: '33%',
      alignItems: 'center',
      padding: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: colors.bgElevated,
    },
    stickerImage: {
      width: 80,
      height: 80,
      borderRadius: borderRadius.sm,
    },
    stickerName: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <Text style={styles.title}>Stickers</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator
              size="large"
              color={colors.accentPrimary}
              style={styles.loader}
            />
          ) : stickerList.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="happy-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No stickers</Text>
              <Text style={styles.emptySubtext}>
                This server has no custom stickers yet
              </Text>
            </View>
          ) : (
            <FlatList
              data={stickerList}
              keyExtractor={(item) => item.id}
              numColumns={3}
              renderItem={renderSticker}
              contentContainerStyle={styles.grid}
              columnWrapperStyle={styles.gridRow}
            />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
