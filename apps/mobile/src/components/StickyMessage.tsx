import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stickyMessages as stickyApi } from '../lib/api';
import { useTheme } from '../lib/theme';
import type { StickyMessageData } from '../types';

interface StickyMessageProps {
  channelId: string;
}

export default function StickyMessage({ channelId }: StickyMessageProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const [sticky, setSticky] = useState<StickyMessageData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
    stickyApi.get(channelId).then((data) => {
      setSticky(data);
    }).catch(() => {});
  }, [channelId]);

  const styles = useMemo(() => StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgElevated,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: neo ? 2 : 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    icon: {
      marginRight: spacing.xs,
    },
    content: {
      flex: 1,
    },
    label: {
      color: colors.accentPrimary,
      fontSize: fontSize.xs,
      fontWeight: neo ? '700' : '600',
      marginBottom: 2,
    },
    text: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      lineHeight: 18,
    },
    dismiss: {
      padding: spacing.xs,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (!sticky || dismissed) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="pin" size={16} color={colors.accentPrimary} style={styles.icon} />
      <View style={styles.content}>
        <Text style={styles.label}>Pinned Message</Text>
        <Text style={styles.text} numberOfLines={2}>{sticky.content}</Text>
      </View>
      <TouchableOpacity style={styles.dismiss} onPress={() => setDismissed(true)}>
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}
