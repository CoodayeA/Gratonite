import React, {
  useCallback,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActionSheetIOS,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { PortalsStackParamList } from '../../navigation/types';
import type { Channel, Message, MessageReaction } from '@gratonite/types';
import { channelsApi, messagesApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { colors, fontSize, spacing, radius } from '../../theme';

type Nav = NativeStackNavigationProp<PortalsStackParamList, 'Channel'>;
type Route = RouteProp<PortalsStackParamList, 'Channel'>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 45%)`;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isToday) return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString()} ${time}`;
}

function generateNonce(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Returns true when two messages are from the same author
 * and within 5 minutes of each other (groupable).
 */
function isGrouped(current: Message, previous: Message | undefined): boolean {
  if (!previous) return false;
  if (current.authorId !== previous.authorId) return false;
  const diff =
    new Date(current.createdAt).getTime() -
    new Date(previous.createdAt).getTime();
  return Math.abs(diff) < 5 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Message Item
// ---------------------------------------------------------------------------
const MessageItem = React.memo(function MessageItem({
  message,
  grouped,
  onLongPress,
}: {
  message: Message;
  grouped: boolean;
  onLongPress: (msg: Message) => void;
}) {
  const authorInitial = (message as any).author?.displayName?.[0] ??
    (message as any).author?.username?.[0] ??
    '?';
  const authorName =
    (message as any).author?.displayName ??
    (message as any).author?.username ??
    'Unknown';

  return (
    <TouchableOpacity
      style={[styles.messageRow, grouped && styles.messageRowGrouped]}
      activeOpacity={0.8}
      onLongPress={() => onLongPress(message)}
      delayLongPress={400}
    >
      {/* Reply reference */}
      {message.referencedMessage && !grouped && (
        <View style={styles.replyBar}>
          <View style={styles.replyLine} />
          <Text style={styles.replyText} numberOfLines={1}>
            Replying to{' '}
            <Text style={styles.replyAuthor}>
              {(message.referencedMessage as any).author?.displayName ??
                (message.referencedMessage as any).author?.username ??
                'someone'}
            </Text>
            {'  '}
            {message.referencedMessage.content}
          </Text>
        </View>
      )}

      {grouped ? (
        /* Grouped: just content, aligned with name above */
        <View style={styles.messageGroupedContent}>
          <Text style={styles.messageText}>{message.content}</Text>
          {message.editedTimestamp && (
            <Text style={styles.editedLabel}>(edited)</Text>
          )}
        </View>
      ) : (
        /* Full message: avatar + name + timestamp + content */
        <View style={styles.messageBody}>
          <Avatar
            size={36}
            userId={message.authorId}
            avatarHash={(message as any).author?.avatarHash ?? undefined}
            displayName={(message as any).author?.displayName}
            username={(message as any).author?.username}
          />
          <View style={styles.messageContent}>
            <View style={styles.messageHeader}>
              <Text style={styles.authorName}>{authorName}</Text>
              <Text style={styles.timestamp}>
                {formatTimestamp(message.createdAt)}
              </Text>
            </View>
            <Text style={styles.messageText}>{message.content}</Text>
            {message.editedTimestamp && (
              <Text style={styles.editedLabel}>(edited)</Text>
            )}
          </View>
        </View>
      )}

      {/* Reactions */}
      {message.reactions && message.reactions.length > 0 && (
        <View style={styles.reactionsRow}>
          {message.reactions.map((r: MessageReaction, i: number) => (
            <View
              key={`${r.emojiName}-${i}`}
              style={[styles.reactionChip, r.me && styles.reactionChipActive]}
            >
              <Text style={styles.reactionEmoji}>{r.emojiName}</Text>
              <Text style={styles.reactionCount}>{r.count}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Message Composer
// ---------------------------------------------------------------------------
function MessageComposer({
  channelId,
  replyTo,
  onCancelReply,
}: {
  channelId: string;
  replyTo: Message | null;
  onCancelReply: () => void;
}) {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();
  const inputRef = useRef<TextInput>(null);

  const sendMutation = useMutation({
    mutationFn: (data: { content: string; nonce: string; messageReference?: { messageId: string; channelId: string } }) =>
      messagesApi.send(channelId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
    },
    onError: (err: Error) => {
      Alert.alert('Send Failed', err.message);
    },
  });

  const handleSend = useCallback(() => {
    const content = text.trim();
    if (!content) return;

    const payload: any = {
      content,
      nonce: generateNonce(),
    };

    if (replyTo) {
      payload.messageReference = {
        messageId: replyTo.id,
        channelId,
      };
    }

    sendMutation.mutate(payload);
    setText('');
    onCancelReply();
  }, [text, replyTo, channelId, sendMutation, onCancelReply]);

  return (
    <View style={styles.composerContainer}>
      {replyTo && (
        <View style={styles.replyPreview}>
          <Text style={styles.replyPreviewText} numberOfLines={1}>
            Replying to{' '}
            <Text style={styles.replyPreviewAuthor}>
              {(replyTo as any).author?.displayName ??
                (replyTo as any).author?.username ??
                'someone'}
            </Text>
          </Text>
          <TouchableOpacity onPress={onCancelReply} activeOpacity={0.6}>
            <Text style={styles.replyPreviewCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.composerRow}>
        <TextInput
          ref={inputRef}
          style={styles.composerInput}
          placeholder="Message..."
          placeholderTextColor={colors.text.muted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={4000}
          returnKeyType="default"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!text.trim() || sendMutation.isPending) &&
              styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
          activeOpacity={0.7}
        >
          <Text style={styles.sendButtonText}>
            {sendMutation.isPending ? '...' : '\u2191'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
export function ChannelScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const { guildId, channelId } = route.params;
  const listRef = useRef<any>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // -- Data fetching --------------------------------------------------------
  const { data: channel } = useQuery<Channel>({
    queryKey: ['channel', channelId],
    queryFn: () => channelsApi.get(channelId),
  });

  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: messagesLoading,
  } = useInfiniteQuery<Message[]>({
    queryKey: ['messages', channelId],
    queryFn: ({ pageParam }) =>
      messagesApi.list(channelId, {
        before: pageParam as string | undefined,
        limit: 50,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.length === 50 ? lastPage[0]?.id : undefined,
    initialPageParam: undefined as string | undefined,
  });

  const messages: Message[] = useMemo(() => {
    if (!messagesData?.pages) return [];
    // API returns newest-first per page. Flatten and reverse for chronological.
    return messagesData.pages.flatMap((page) => page).reverse();
  }, [messagesData]);

  // -- Navigation header ----------------------------------------------------
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerHash}>#</Text>
          <View style={styles.headerTitleInfo}>
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {channel?.name ?? 'Loading...'}
            </Text>
            {channel?.topic ? (
              <Text style={styles.headerTopicText} numberOfLines={1}>
                {channel.topic}
              </Text>
            ) : null}
          </View>
        </View>
      ),
      headerBlurEffect: 'dark',
      headerTransparent: true,
    });
  }, [navigation, channel]);

  // -- Handlers -------------------------------------------------------------
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const editMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      messagesApi.edit(channelId, messageId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (messageId: string) =>
      messagesApi.delete(channelId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
    },
  });

  const handleLongPress = useCallback(
    (message: Message) => {
      const isOwn = message.authorId === currentUser?.id;

      const options: string[] = ['Reply', 'Copy Text'];
      if (isOwn) {
        options.push('Edit Message', 'Delete Message');
      }
      options.push('Cancel');
      const cancelIndex = options.length - 1;
      const destructiveIndex = isOwn ? options.indexOf('Delete Message') : -1;

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex: cancelIndex,
            destructiveButtonIndex: destructiveIndex,
          },
          (buttonIndex) => {
            const selected = options[buttonIndex];
            if (selected) handleActionOption(selected, message);
          },
        );
      } else {
        // Android fallback using Alert
        Alert.alert('Message', undefined, [
          {
            text: 'Reply',
            onPress: () => handleActionOption('Reply', message),
          },
          {
            text: 'Copy Text',
            onPress: () => handleActionOption('Copy Text', message),
          },
          ...(isOwn
            ? [
                {
                  text: 'Edit Message',
                  onPress: () => handleActionOption('Edit Message', message),
                },
                {
                  text: 'Delete Message',
                  style: 'destructive' as const,
                  onPress: () => handleActionOption('Delete Message', message),
                },
              ]
            : []),
          { text: 'Cancel', style: 'cancel' as const },
        ]);
      }
    },
    [currentUser?.id],
  );

  const handleActionOption = useCallback(
    (option: string, message: Message) => {
      switch (option) {
        case 'Reply':
          setReplyTo(message);
          break;
        case 'Copy Text':
          try {
            // Dynamic import to avoid hard dependency
            const ClipboardModule = require('expo-clipboard');
            if (ClipboardModule?.setStringAsync) {
              ClipboardModule.setStringAsync(message.content);
            }
          } catch {
            // Fallback: expo-clipboard not installed, silently ignore
          }
          break;
        case 'Edit Message':
          Alert.prompt?.(
            'Edit Message',
            undefined,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Save',
                onPress: (newContent?: string) => {
                  if (newContent?.trim()) {
                    editMutation.mutate({
                      messageId: message.id,
                      content: newContent.trim(),
                    });
                  }
                },
              },
            ],
            'plain-text',
            message.content,
          );
          break;
        case 'Delete Message':
          Alert.alert('Delete Message', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => deleteMutation.mutate(message.id),
            },
          ]);
          break;
      }
    },
    [editMutation, deleteMutation],
  );

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  // -- Render helpers -------------------------------------------------------
  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const prevMessage = index > 0 ? messages[index - 1] : undefined;
      const grouped = isGrouped(item, prevMessage);
      return (
        <MessageItem
          message={item}
          grouped={grouped}
          onLongPress={handleLongPress}
        />
      );
    },
    [messages, handleLongPress],
  );

  // -- Render ---------------------------------------------------------------
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.messagesContainer}>
        {messagesLoading && messages.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>#</Text>
            <Text style={styles.emptyTitle}>
              Welcome to #{channel?.name ?? 'channel'}
            </Text>
            <Text style={styles.emptySubtitle}>
              This is the beginning of the channel. Start the conversation!
            </Text>
          </View>
        ) : (
          <FlashList
            ref={listRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListHeaderComponent={
              isFetchingNextPage ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator
                    size="small"
                    color={colors.brand.primary}
                  />
                </View>
              ) : null
            }
          />
        )}
      </View>

      <MessageComposer
        channelId={channelId}
        replyTo={replyTo}
        onCancelReply={handleCancelReply}
      />
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  messagesContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  emptyIcon: {
    fontSize: 48,
    color: colors.text.muted,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  listContent: {
    paddingTop: 100, // space for transparent header
    paddingBottom: spacing.sm,
  },
  loadingMore: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },

  // Header
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: 240,
  },
  headerHash: {
    color: colors.text.muted,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  headerTitleInfo: {
    flexShrink: 1,
  },
  headerTitleText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  headerTopicText: {
    color: colors.text.muted,
    fontSize: fontSize.xs,
  },

  // Message row
  messageRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  messageRowGrouped: {
    paddingTop: 2,
  },
  messageBody: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  messageContent: {
    flex: 1,
  },
  messageGroupedContent: {
    marginLeft: 36 + spacing.sm, // avatar width + gap
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: 2,
  },
  authorName: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  timestamp: {
    color: colors.text.muted,
    fontSize: fontSize.xs,
  },
  messageText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  editedLabel: {
    color: colors.text.muted,
    fontSize: fontSize.xs,
    marginLeft: spacing.xs,
  },

  // Reply reference
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 36 + spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  replyLine: {
    width: 2,
    height: 14,
    backgroundColor: colors.brand.primary,
    borderRadius: 1,
  },
  replyText: {
    color: colors.text.muted,
    fontSize: fontSize.xs,
    flex: 1,
  },
  replyAuthor: {
    color: colors.text.secondary,
    fontWeight: '600',
  },

  // Reactions
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 36 + spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  reactionChipActive: {
    borderColor: colors.brand.primary,
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },

  // Composer
  composerContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.stroke.primary,
    backgroundColor: colors.bg.secondary,
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.tertiary,
    borderBottomWidth: 1,
    borderBottomColor: colors.stroke.primary,
  },
  replyPreviewText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    flex: 1,
  },
  replyPreviewAuthor: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  replyPreviewCancel: {
    color: colors.accent.error,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginLeft: spacing.md,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  composerInput: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    fontSize: fontSize.md,
    color: colors.text.primary,
    maxHeight: 120,
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
});
