import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pins } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { formatRelativeTime } from '../lib/formatters';
import { useTheme } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PinnedMessage } from '../types';

interface PinnedMessagesProps {
  visible: boolean;
  onClose: () => void;
  channelId: string;
}

export default function PinnedMessages({ visible, onClose, channelId }: PinnedMessagesProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [pinnedList, setPinnedList] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPins = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pins.list(channelId);
      setPinnedList(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    if (visible) {
      fetchPins();
    }
  }, [visible, fetchPins]);

  const handleUnpin = (item: PinnedMessage) => {
    Alert.alert('Unpin Message', 'Remove this pinned message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unpin',
        style: 'destructive',
        onPress: async () => {
          try {
            await pins.remove(channelId, item.id);
            setPinnedList((prev) => prev.filter((p) => p.id !== item.id));
            toast.success('Message unpinned.');
          } catch {
            toast.error('Failed to unpin message');
          }
        },
      },
    ]);
  };

  const renderPin = ({ item }: { item: PinnedMessage }) => {
    const authorName =
      item.author?.displayName || item.author?.username || item.authorId.slice(0, 8);

    return (
      <View style={styles.pinItem}>
        <View style={styles.pinHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{authorName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.authorName}>{authorName}</Text>
          <Text style={styles.pinnedDate}>{formatRelativeTime(item.pinnedAt)}</Text>
          <TouchableOpacity onPress={() => handleUnpin(item)} hitSlop={8} accessibilityLabel="Unpin message">
            <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.pinContent} numberOfLines={3}>
          {item.content}
        </Text>
      </View>
    );
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
      maxHeight: '70%',
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
    listContent: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    pinItem: {
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    pinHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    avatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: colors.white,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    authorName: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      flex: 1,
    },
    pinnedDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    pinContent: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 20,
    },
    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxxl,
      gap: spacing.sm,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.md,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <Text style={styles.title}>Pinned Messages</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator
              size="large"
              color={colors.accentPrimary}
              style={styles.loader}
            />
          ) : (
            <FlatList
              data={pinnedList}
              keyExtractor={(item) => item.id}
              renderItem={renderPin}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="pin-outline" size={40} color={colors.textMuted} />
                  <Text style={styles.emptyText}>No pinned messages</Text>
                </View>
              }
            />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
