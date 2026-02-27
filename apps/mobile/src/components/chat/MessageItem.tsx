import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Avatar } from '../ui/Avatar';
import { ReactionBar } from './ReactionBar';
import { colors, spacing, radius, fontSize } from '../../theme';
import type { Message, MessageAttachment, MessageReaction } from '../../stores/messages.store';

// ── Types ────────────────────────────────────────────

interface MessageItemProps {
  message: Message;
  isGrouped: boolean;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (messageId: string) => void;
  onReact: (messageId: string) => void;
  onPressAvatar: (userId: string) => void;
  currentUserId: string;
}

// ── Helpers ──────────────────────────────────────────

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (isToday) return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;

  return `${date.toLocaleDateString([], {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  })} ${time}`;
}

/**
 * Render basic inline markdown: **bold**, *italic*, `code`, ~~strikethrough~~
 * Returns an array of React Native Text elements.
 */
function renderMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Combined regex: bold, strikethrough, italic, inline code
  const regex = /(\*\*(.+?)\*\*)|(~~(.+?)~~)|(\*(.+?)\*)|(`(.+?)`)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    // Push text before this match
    if (match.index > lastIndex) {
      parts.push(
        <Text key={`t-${keyIdx++}`}>
          {text.slice(lastIndex, match.index)}
        </Text>,
      );
    }

    if (match[2]) {
      // **bold**
      parts.push(
        <Text key={`b-${keyIdx++}`} style={markdownStyles.bold}>
          {match[2]}
        </Text>,
      );
    } else if (match[4]) {
      // ~~strikethrough~~
      parts.push(
        <Text key={`s-${keyIdx++}`} style={markdownStyles.strikethrough}>
          {match[4]}
        </Text>,
      );
    } else if (match[6]) {
      // *italic*
      parts.push(
        <Text key={`i-${keyIdx++}`} style={markdownStyles.italic}>
          {match[6]}
        </Text>,
      );
    } else if (match[8]) {
      // `code`
      parts.push(
        <Text key={`c-${keyIdx++}`} style={markdownStyles.code}>
          {match[8]}
        </Text>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(
      <Text key={`t-${keyIdx++}`}>{text.slice(lastIndex)}</Text>,
    );
  }

  return parts.length > 0 ? parts : [<Text key="plain">{text}</Text>];
}

function isImageFile(contentType?: string, filename?: string): boolean {
  if (contentType?.startsWith('image/')) return true;
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext ?? '');
  }
  return false;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── System message component ─────────────────────────

function SystemMessage({ message }: { message: Message }) {
  return (
    <View style={styles.systemContainer}>
      <Text style={styles.systemText}>{message.content}</Text>
    </View>
  );
}

// ── Deleted message component ────────────────────────

function DeletedMessage({ isGrouped }: { isGrouped: boolean }) {
  return (
    <View style={[styles.row, isGrouped && styles.groupedRow]}>
      <View style={styles.avatarSpacer} />
      <View style={styles.contentColumn}>
        <Text style={styles.deletedText}>[message deleted]</Text>
      </View>
    </View>
  );
}

// ── Reply preview component ──────────────────────────

function ReplyPreview({ referencedMessage }: { referencedMessage: Message }) {
  const authorName =
    referencedMessage.author?.displayName ??
    referencedMessage.author?.username ??
    'Unknown';
  const previewText =
    referencedMessage.deletedAt
      ? '[message deleted]'
      : referencedMessage.content.length > 80
        ? referencedMessage.content.slice(0, 80) + '...'
        : referencedMessage.content;

  return (
    <View style={styles.replyPreview}>
      <View style={styles.replyBar} />
      <Text style={styles.replyAuthor} numberOfLines={1}>
        {authorName}
      </Text>
      <Text style={styles.replyContent} numberOfLines={1}>
        {previewText}
      </Text>
    </View>
  );
}

// ── Attachment component ─────────────────────────────

function AttachmentView({ attachment }: { attachment: MessageAttachment }) {
  if (isImageFile(attachment.contentType, attachment.filename)) {
    const aspectRatio =
      attachment.width && attachment.height
        ? attachment.width / attachment.height
        : 16 / 9;
    const maxWidth = 260;
    const width = Math.min(maxWidth, attachment.width ?? maxWidth);
    const height = width / aspectRatio;

    return (
      <TouchableOpacity style={styles.imageAttachment} activeOpacity={0.8}>
        <Image
          source={{ uri: attachment.proxyUrl ?? attachment.url }}
          style={[styles.attachmentImage, { width, height }]}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      </TouchableOpacity>
    );
  }

  // Non-image file
  return (
    <TouchableOpacity style={styles.fileAttachment} activeOpacity={0.7}>
      <View style={styles.fileIconContainer}>
        <Text style={styles.fileIconText}>F</Text>
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {attachment.filename}
        </Text>
        <Text style={styles.fileSize}>{formatFileSize(attachment.size)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main component ───────────────────────────────────

export const MessageItem = React.memo(function MessageItem({
  message,
  isGrouped,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onPressAvatar,
  currentUserId,
}: MessageItemProps) {
  const isOwn = message.authorId === currentUserId;
  const isSystemMessage = message.type !== 'DEFAULT' && message.type !== 'REPLY';
  const isDeleted = !!message.deletedAt;

  const authorName = useMemo(
    () =>
      message.author?.displayName ?? message.author?.username ?? 'Unknown User',
    [message.author],
  );

  // ── Long press handler ──────────────────────────────

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const options: string[] = ['Reply', 'React', 'Copy Text'];
    if (isOwn) {
      options.push('Edit', 'Delete');
    }
    options.push('Pin', 'Cancel');

    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = isOwn ? options.indexOf('Delete') : undefined;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          destructiveButtonIndex,
        },
        (buttonIndex) => {
          const selected = options[buttonIndex];
          if (selected) handleActionSheetPress(selected);
        },
      );
    } else {
      // Android fallback using Alert
      Alert.alert(
        'Message Actions',
        undefined,
        [
          ...options
            .filter((o) => o !== 'Cancel')
            .map((option) => ({
              text: option,
              style: (option === 'Delete' ? 'destructive' : 'default') as 'destructive' | 'default',
              onPress: () => handleActionSheetPress(option),
            })),
          { text: 'Cancel', style: 'cancel' as const, onPress: () => {} },
        ],
      );
    }
  }, [isOwn, message]);

  const handleActionSheetPress = useCallback(
    (action: string) => {
      switch (action) {
        case 'Reply':
          onReply(message);
          break;
        case 'React':
          onReact(message.id);
          break;
        case 'Copy Text':
          // Clipboard.setString(message.content) in production
          break;
        case 'Edit':
          onEdit(message);
          break;
        case 'Delete':
          Alert.alert(
            'Delete Message',
            'Are you sure you want to delete this message?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => onDelete(message.id),
              },
            ],
          );
          break;
        case 'Pin':
          // Pin functionality placeholder
          break;
      }
    },
    [message, onReply, onEdit, onDelete, onReact],
  );

  // ── Render system messages ──────────────────────────

  if (isSystemMessage) {
    return <SystemMessage message={message} />;
  }

  // ── Render deleted messages ─────────────────────────

  if (isDeleted) {
    return <DeletedMessage isGrouped={isGrouped} />;
  }

  // ── Render grouped (continuation) message ───────────

  if (isGrouped) {
    return (
      <TouchableOpacity
        style={styles.groupedRow}
        onLongPress={handleLongPress}
        activeOpacity={0.8}
        delayLongPress={300}
      >
        <View style={styles.avatarSpacer} />
        <View style={styles.contentColumn}>
          {message.referencedMessage && (
            <ReplyPreview referencedMessage={message.referencedMessage} />
          )}
          <Text style={styles.messageText}>
            {renderMarkdown(message.content)}
            {message.editedTimestamp && (
              <Text style={styles.editedText}> (edited)</Text>
            )}
          </Text>
          {message.attachments && message.attachments.length > 0 && (
            <View style={styles.attachments}>
              {message.attachments.map((att) => (
                <AttachmentView key={att.id} attachment={att} />
              ))}
            </View>
          )}
          {message.reactions && message.reactions.length > 0 && (
            <ReactionBar
              reactions={message.reactions}
              messageId={message.id}
              channelId={message.channelId}
              onAddReaction={() => onReact(message.id)}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // ── Render non-grouped (first message from author) ──

  return (
    <TouchableOpacity
      style={styles.row}
      onLongPress={handleLongPress}
      activeOpacity={0.8}
      delayLongPress={300}
    >
      <TouchableOpacity
        style={styles.avatarWrapper}
        onPress={() => onPressAvatar(message.authorId)}
        activeOpacity={0.7}
      >
        <Avatar
          size={36}
          userId={message.authorId}
          avatarHash={message.author?.avatarHash}
          displayName={message.author?.displayName}
          username={message.author?.username}
        />
      </TouchableOpacity>

      <View style={styles.contentColumn}>
        {message.referencedMessage && (
          <ReplyPreview referencedMessage={message.referencedMessage} />
        )}

        <View style={styles.authorRow}>
          <Text style={styles.authorName}>{authorName}</Text>
          <Text style={styles.timestamp}>
            {formatTimestamp(message.createdAt)}
          </Text>
        </View>

        <Text style={styles.messageText}>
          {renderMarkdown(message.content)}
          {message.editedTimestamp && (
            <Text style={styles.editedText}> (edited)</Text>
          )}
        </Text>

        {message.attachments && message.attachments.length > 0 && (
          <View style={styles.attachments}>
            {message.attachments.map((att) => (
              <AttachmentView key={att.id} attachment={att} />
            ))}
          </View>
        )}

        {message.reactions && message.reactions.length > 0 && (
          <ReactionBar
            reactions={message.reactions}
            messageId={message.id}
            channelId={message.channelId}
            onAddReaction={() => onReact(message.id)}
          />
        )}
      </View>
    </TouchableOpacity>
  );
});

// ── Markdown inline styles ───────────────────────────

const markdownStyles = StyleSheet.create({
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  code: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: colors.bg.tertiary,
    borderRadius: 3,
    paddingHorizontal: 4,
    fontSize: fontSize.sm - 1,
    color: colors.text.primary,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: colors.text.muted,
  },
});

// ── Styles ───────────────────────────────────────────

const AVATAR_SIZE = 36;
const AVATAR_COLUMN_WIDTH = AVATAR_SIZE + spacing.md;

const styles = StyleSheet.create({
  // ── Row layouts ────────────────────────────
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  groupedRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: 1,
  },
  avatarWrapper: {
    width: AVATAR_COLUMN_WIDTH,
    paddingTop: 2,
  },
  avatarSpacer: {
    width: AVATAR_COLUMN_WIDTH,
  },
  contentColumn: {
    flex: 1,
  },

  // ── Author + timestamp ────────────────────
  authorRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: 2,
  },
  authorName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  timestamp: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },

  // ── Message text ──────────────────────────
  messageText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    lineHeight: fontSize.md * 1.4,
  },
  editedText: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    fontStyle: 'italic',
  },

  // ── Deleted ───────────────────────────────
  deletedText: {
    fontSize: fontSize.md,
    color: colors.text.muted,
    fontStyle: 'italic',
  },

  // ── System messages ───────────────────────
  systemContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  systemText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // ── Reply preview ─────────────────────────
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    paddingLeft: spacing.sm,
    gap: spacing.xs,
  },
  replyBar: {
    width: 2,
    height: 14,
    backgroundColor: colors.brand.primary,
    borderRadius: 1,
  },
  replyAuthor: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.brand.primary,
  },
  replyContent: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    flex: 1,
  },

  // ── Attachments ───────────────────────────
  attachments: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  imageAttachment: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  attachmentImage: {
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    gap: spacing.sm,
    maxWidth: 280,
  },
  fileIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text.muted,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: fontSize.sm,
    color: colors.text.link,
    fontWeight: '500',
  },
  fileSize: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
});
