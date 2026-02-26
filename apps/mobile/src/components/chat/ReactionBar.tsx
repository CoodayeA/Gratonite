import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi } from '../../lib/api';
import { colors, spacing, radius, fontSize } from '../../theme';
import type { MessageReaction } from '../../stores/messages.store';

// ── Types ────────────────────────────────────────────

interface ReactionBarProps {
  reactions: MessageReaction[];
  messageId: string;
  channelId: string;
  onAddReaction: () => void;
}

// ── Component ────────────────────────────────────────

export function ReactionBar({
  reactions,
  messageId,
  channelId,
  onAddReaction,
}: ReactionBarProps) {
  const queryClient = useQueryClient();

  const toggleReaction = useMutation({
    mutationFn: async ({ emoji, hasReacted }: { emoji: string; hasReacted: boolean }) => {
      if (hasReacted) {
        await messagesApi.removeReaction(channelId, messageId, emoji);
      } else {
        await messagesApi.addReaction(channelId, messageId, emoji);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
    },
  });

  const handlePress = useCallback(
    (emoji: string, hasReacted: boolean) => {
      toggleReaction.mutate({ emoji, hasReacted });
    },
    [toggleReaction],
  );

  if (!reactions || reactions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {reactions.map((reaction) => {
        const key = reaction.emojiId ?? reaction.emojiName;
        return (
          <TouchableOpacity
            key={key}
            style={[
              styles.chip,
              reaction.me && styles.chipActive,
            ]}
            onPress={() => handlePress(reaction.emojiName, reaction.me)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{reaction.emojiName}</Text>
            <Text
              style={[
                styles.count,
                reaction.me && styles.countActive,
              ]}
            >
              {reaction.count}
            </Text>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={styles.addButton}
        onPress={onAddReaction}
        activeOpacity={0.7}
      >
        <Text style={styles.addIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 1,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    gap: spacing.xs,
  },
  chipActive: {
    borderColor: colors.brand.primary,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
  },
  emoji: {
    fontSize: fontSize.sm,
  },
  count: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  countActive: {
    color: colors.brand.primary,
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 1,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  addIcon: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    fontWeight: '600',
  },
});
