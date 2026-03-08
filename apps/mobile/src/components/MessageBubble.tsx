import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import Avatar from './Avatar';
import RichText from './RichText';
import PollCard from './PollCard';
import { useColors, useNeo, spacing, fontSize, borderRadius } from '../lib/theme';
import { formatTime } from '../lib/formatters';
import type { Message, ReactionGroup, Poll } from '../types';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isGrouped: boolean;
  reactions?: ReactionGroup[];
  replyPreview?: { authorName: string; content: string } | null;
  onLongPress?: () => void;
  onReactionToggle?: (emoji: string) => void;
  onReactionAdd?: () => void;
  onReplyPress?: () => void;
  poll?: Poll;
  onPollVote?: (pollId: string, optionId: string) => void;
  onPollRemoveVote?: (pollId: string) => void;
  isNewMessage?: boolean;
  customEmojis?: Array<{ name: string; imageHash: string }>;
}

export default function MessageBubble({
  message,
  isOwn,
  isGrouped,
  reactions = [],
  replyPreview,
  onLongPress,
  onReactionToggle,
  onReactionAdd,
  onReplyPress,
  poll,
  onPollVote,
  onPollRemoveVote,
  isNewMessage,
  customEmojis,
}: MessageBubbleProps) {
  const colors = useColors();
  const neo = useNeo();
  const authorName = message.author?.displayName || message.author?.username || message.authorId.slice(0, 8);

  const styles = useMemo(() => StyleSheet.create({
    messageRow: {
      marginBottom: spacing.md,
    },
    messageGrouped: {
      marginBottom: spacing.xs,
    },
    messageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
      gap: spacing.sm,
    },
    authorName: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    messageTime: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    edited: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontStyle: 'italic',
    },
    bubbleWrapper: {
      marginLeft: 40,
      alignItems: 'flex-start',
    },
    groupedWrapper: {
      marginTop: -spacing.xs,
    },
    bubble: {
      backgroundColor: colors.bgElevated,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.lg,
      maxWidth: '85%',
      ...(neo ? {
        borderWidth: 2,
        borderColor: '#000',
        borderRadius: 0,
        shadowColor: neo.shadowColor,
        shadowOffset: neo.shadowOffset,
        shadowOpacity: neo.shadowOpacity,
        shadowRadius: neo.shadowRadius,
      } : {}),
    },
    bubbleOther: {
      borderTopLeftRadius: neo ? 0 : 4,
    },
    bubbleOwn: {
      backgroundColor: colors.accentPrimary,
      borderTopRightRadius: neo ? 0 : 4,
    },
    replyPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 40,
      marginBottom: spacing.xs,
      gap: spacing.sm,
    },
    replyLine: {
      width: 2,
      height: 16,
      backgroundColor: colors.accentPrimary,
      borderRadius: 1,
    },
    replyText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      flex: 1,
    },
    replyAuthor: {
      fontWeight: '600',
      color: colors.textSecondary,
    },
    reactionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginLeft: 40,
      marginTop: spacing.xs,
      gap: spacing.xs,
    },
    reactionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.transparent,
      ...(neo ? { borderRadius: 0, borderWidth: 2, borderColor: '#000' } : {}),
    },
    reactionChipActive: {
      borderColor: colors.accentPrimary,
      backgroundColor: colors.accentLight,
    },
    reactionEmoji: {
      fontSize: fontSize.sm,
    },
    reactionCount: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
    },
    reactionCountActive: {
      color: colors.accentPrimary,
    },
    reactionAddBtn: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
  }), [colors, neo]);

  const entering = isNewMessage
    ? isOwn
      ? SlideInRight.duration(250)
      : FadeIn.duration(200)
    : undefined;

  return (
    <Animated.View entering={entering}>
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={onLongPress}
      style={[styles.messageRow, isGrouped && styles.messageGrouped]}
    >
      {/* Reply preview */}
      {replyPreview && (
        <TouchableOpacity style={styles.replyPreview} onPress={onReplyPress}>
          <View style={styles.replyLine} />
          <Text style={styles.replyText} numberOfLines={1}>
            <Text style={styles.replyAuthor}>{replyPreview.authorName}</Text>{' '}
            {replyPreview.content}
          </Text>
        </TouchableOpacity>
      )}

      {!isGrouped && (
        <View style={styles.messageHeader}>
          <Avatar
            userId={message.authorId}
            avatarHash={message.author?.avatarHash}
            name={authorName}
            size={32}
          />
          <Text style={styles.authorName}>{authorName}</Text>
          <Text style={styles.messageTime}>{formatTime(message.createdAt)}</Text>
          {message.editedAt && <Text style={styles.edited}>(edited)</Text>}
        </View>
      )}

      <View style={[styles.bubbleWrapper, isGrouped && styles.groupedWrapper]}>
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          <RichText content={message.content} color={isOwn ? colors.white : colors.textPrimary} customEmojis={customEmojis} />
        </View>
      </View>

      {poll && onPollVote && onPollRemoveVote && (
        <View style={{ marginLeft: 40, marginTop: spacing.sm }}>
          <PollCard poll={poll} onVote={onPollVote} onRemoveVote={onPollRemoveVote} />
        </View>
      )}

      {/* Reactions */}
      {reactions.length > 0 && (
        <View style={styles.reactionsRow}>
          {reactions.map((r) => (
            <TouchableOpacity
              key={r.emoji}
              style={[styles.reactionChip, r.me && styles.reactionChipActive]}
              onPress={() => onReactionToggle?.(r.emoji)}
            >
              <Text style={styles.reactionEmoji}>{r.emoji}</Text>
              <Text style={[styles.reactionCount, r.me && styles.reactionCountActive]}>{r.count}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.reactionAddBtn} onPress={onReactionAdd}>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
    </Animated.View>
  );
}
