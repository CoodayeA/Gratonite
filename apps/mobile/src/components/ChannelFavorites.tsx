import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import type { Channel } from '../types';

interface ChannelFavoritesProps {
  favorites: Channel[];
  onSelect: (channel: Channel) => void;
}

export default function ChannelFavorites({ favorites, onSelect }: ChannelFavoritesProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  if (favorites.length === 0) {
    return null;
  }

  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xs,
    },
    headerText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '700',
      letterSpacing: 1,
    },
    channelItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    channelName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      flex: 1,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="star" size={14} color={colors.warning} />
        <Text style={styles.headerText}>FAVORITES</Text>
      </View>
      {favorites.map((channel) => (
        <TouchableOpacity
          key={channel.id}
          style={styles.channelItem}
          onPress={() => onSelect(channel)}
        >
          <Ionicons
            name="star"
            size={16}
            color={colors.warning}
          />
          <Ionicons
            name={channel.type === 'voice' || channel.type === 'GUILD_VOICE' ? 'volume-medium' : 'chatbubble-outline'}
            size={16}
            color={colors.textSecondary}
          />
          <Text style={styles.channelName} numberOfLines={1}>
            {channel.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
