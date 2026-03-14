import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import Avatar from './Avatar';
import RichText from './RichText';
import AttachmentPreview from './AttachmentPreview';
import MediaViewer from './MediaViewer';
import PollCard from './PollCard';
import { useColors, useNeo, useGlass, spacing, fontSize, borderRadius } from '../lib/theme';
import { formatTime } from '../lib/formatters';
import { heavyImpact } from '../lib/haptics';
import type { Message, ReactionGroup, TextReactionGroup, Poll } from '../types';
import DisappearTimer from './DisappearTimer';
import { Ionicons } from '@expo/vector-icons';

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
  onReactionLongPress?: (emoji: string) => void;
  textReactions?: TextReactionGroup[];
  onTextReactionToggle?: (text: string) => void;
  isEncrypted?: boolean;
  decryptedContent?: string;
  channelDisappearTimer?: number | null;
  forwardingDisabled?: boolean;
}

function MessageBubbleInner({
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
  onReactionLongPress,
  textReactions = [],
  onTextReactionToggle,
  isEncrypted,
  decryptedContent,
  channelDisappearTimer,
  forwardingDisabled,
}: MessageBubbleProps) {
  const colors = useColors();
  const neo = useNeo();
  const glass = useGlass();
  const authorName = message.author?.displayName || message.author?.username || message.authorId?.slice(0, 8) || 'Unknown';

  // Media viewer state
  const [showViewer, setShowViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Collect image URLs from attachments for gallery
  const imageUrls = useMemo(
    () => (message.attachments || []).filter(a => a.contentType?.startsWith('image/')).map(a => a.url),
    [message.attachments],
  );

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
      backgroundColor: glass ? glass.glassBackground : colors.bgElevated,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: neo ? 0 : glass ? borderRadius.xl : borderRadius.lg,
      maxWidth: '85%',
      ...(neo ? {
        borderWidth: 2,
        borderColor: '#000',
        shadowColor: neo.shadowColor,
        shadowOffset: neo.shadowOffset,
        shadowOpacity: neo.shadowOpacity,
        shadowRadius: neo.shadowRadius,
      } : {}),
      ...(glass ? {
        borderWidth: 1,
        borderColor: glass.glassBorder,
      } : {}),
    },
    bubbleOther: {
      borderTopLeftRadius: neo ? 0 : glass ? 4 : 4,
    },
    bubbleOwn: {
      backgroundColor: colors.accentPrimary,
      borderTopRightRadius: neo ? 0 : glass ? 4 : 4,
      ...(glass ? {
        shadowColor: colors.accentPrimary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      } : {}),
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
      backgroundColor: glass ? glass.glassBackground : colors.bgElevated,
      borderRadius: neo ? 0 : borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      gap: 4,
      borderWidth: neo ? 2 : glass ? 1 : 1,
      borderColor: neo ? '#000' : glass ? glass.glassBorder : colors.transparent,
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
    textReactionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginLeft: 40,
      marginTop: spacing.xs,
      gap: spacing.xs,
    },
    textReactionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.transparent,
    },
    textReactionChipActive: {
      borderColor: colors.accentPrimary,
      backgroundColor: colors.accentLight,
    },
    textReactionText: {
      fontSize: fontSize.xs,
      color: colors.textPrimary,
    },
    textReactionCount: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
    },
    textReactionCountActive: {
      color: colors.accentPrimary,
    },
    lockIcon: {
      marginLeft: 4,
    },
  }), [colors, neo, glass]);

  const entering = isNewMessage
    ? isOwn
      ? SlideInRight.duration(250)
      : FadeIn.duration(200)
    : undefined;

  return (
    <Animated.View entering={entering}>
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={() => { heavyImpact(); onLongPress?.(); }}
      style={[styles.messageRow, isGrouped && styles.messageGrouped]}
      accessibilityRole="text"
      accessibilityLabel={`${authorName}: ${message.content ?? ''}, ${formatTime(message.createdAt)}`}
    >
      {/* Reply preview */}
      {replyPreview && (
        <TouchableOpacity style={styles.replyPreview} onPress={onReplyPress} accessibilityLabel="Jump to replied message">
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
          {isEncrypted && (
            <Ionicons
              name={decryptedContent && decryptedContent !== '[Decryption failed]' ? 'lock-closed' : 'lock-open-outline'}
              size={12}
              color={decryptedContent && decryptedContent !== '[Decryption failed]' ? '#22c55e' : colors.warning}
              style={styles.lockIcon}
            />
          )}
          {message.editedAt && <Text style={styles.edited}>(edited)</Text>}
        </View>
      )}

      {(decryptedContent ?? message.content)?.trim() ? (
        <View style={[styles.bubbleWrapper, isGrouped && styles.groupedWrapper]}>
          <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
            <RichText content={decryptedContent ?? message.content} color={isOwn ? colors.white : colors.textPrimary} customEmojis={customEmojis} />
          </View>
        </View>
      ) : null}

      {/* Attachments (images, GIFs, files) */}
      {message.attachments && message.attachments.length > 0 && (
        <View style={{ marginLeft: 40, marginTop: spacing.xs, gap: spacing.xs }}>
          {message.attachments.map((att) => {
            const imgIdx = imageUrls.indexOf(att.url);
            return (
              <AttachmentPreview
                key={att.id}
                attachment={att}
                allImageUrls={imageUrls}
                imageIndex={imgIdx >= 0 ? imgIdx : undefined}
                onImagePress={(_url, _allUrls, idx) => {
                  setViewerIndex(idx ?? 0);
                  setShowViewer(true);
                }}
              />
            );
          })}
        </View>
      )}

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
              onLongPress={() => onReactionLongPress?.(r.emoji)}
              accessibilityRole="button"
              accessibilityLabel={`${r.emoji} reaction, ${r.count} ${r.count === 1 ? 'person' : 'people'}`}
            >
              <Text style={styles.reactionEmoji}>{r.emoji}</Text>
              <Text style={[styles.reactionCount, r.me && styles.reactionCountActive]}>{r.count}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.reactionAddBtn} onPress={onReactionAdd} accessibilityLabel="Add reaction">
            <Text style={{ fontSize: 14, color: colors.textMuted }}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Disappear timer */}
      {channelDisappearTimer && channelDisappearTimer > 0 && (
        <DisappearTimer createdAt={message.createdAt} disappearTimer={channelDisappearTimer} />
      )}

      {/* Text Reactions */}
      {textReactions.length > 0 && (
        <View style={styles.textReactionsRow}>
          {textReactions.map((tr) => (
            <TouchableOpacity
              key={tr.text}
              style={[styles.textReactionChip, tr.me && styles.textReactionChipActive]}
              onPress={() => onTextReactionToggle?.(tr.text)}
              accessibilityLabel={`Toggle ${tr.text} reaction`}
            >
              <Text style={styles.textReactionText}>{tr.text}</Text>
              <Text style={[styles.textReactionCount, tr.me && styles.textReactionCountActive]}>{tr.count}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </TouchableOpacity>

      {/* Full-screen media viewer */}
      {imageUrls.length > 0 && (
        <MediaViewer
          visible={showViewer}
          urls={imageUrls}
          initialIndex={viewerIndex}
          onClose={() => setShowViewer(false)}
        />
      )}
    </Animated.View>
  );
}

const MessageBubble = React.memo(MessageBubbleInner);
export default MessageBubble;
