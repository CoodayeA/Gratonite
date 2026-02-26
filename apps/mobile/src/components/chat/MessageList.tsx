import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { FlashList, type FlashListRef, type ListRenderItemInfo } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { messagesApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { useMessagesStore } from '../../stores/messages.store';
import { MessageItem } from './MessageItem';
import { TypingIndicator } from './TypingIndicator';
import { colors, spacing, radius, fontSize } from '../../theme';
import type { Message } from '../../stores/messages.store';

// ── Types ────────────────────────────────────────────

interface MessageListProps {
  channelId: string;
  guildId?: string;
  onPressAvatar: (userId: string) => void;
}

/** Union type for items rendered in the list (messages + date separators) */
type ListItem =
  | { type: 'message'; message: Message; isGrouped: boolean }
  | { type: 'separator'; date: string; key: string };

// ── Helpers ──────────────────────────────────────────

const GROUPING_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function formatDateSeparator(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/**
 * Determine if a message should be grouped with the previous message.
 * Messages are grouped when they are from the same author and
 * within the 5-minute window.
 */
function shouldGroup(current: Message, previous: Message | undefined): boolean {
  if (!previous) return false;
  if (current.authorId !== previous.authorId) return false;
  if (current.type !== 'DEFAULT' && current.type !== 'REPLY') return false;
  if (previous.type !== 'DEFAULT' && previous.type !== 'REPLY') return false;

  const timeDiff =
    new Date(current.createdAt).getTime() -
    new Date(previous.createdAt).getTime();
  return timeDiff < GROUPING_WINDOW_MS;
}

// ── Component ────────────────────────────────────────

export function MessageList({
  channelId,
  guildId,
  onPressAvatar,
}: MessageListProps) {
  const currentUserId = useAuthStore((s) => s.user?.id ?? '');
  const setReplyingTo = useMessagesStore((s) => s.setReplyingTo);
  const flashListRef = useRef<FlashListRef<ListItem>>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // ── Data fetching ───────────────────────────────────

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['messages', channelId],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params: { limit: number; before?: string } = { limit: 50 };
      if (pageParam) {
        params.before = pageParam;
      }
      return messagesApi.list(channelId, params) as Promise<Message[]>;
    },
    getNextPageParam: (lastPage: Message[]) => {
      // If we got fewer than 50, there are no more older messages
      if (lastPage.length < 50) return undefined;
      // The cursor is the oldest message ID in this page
      return lastPage[0]?.id;
    },
    initialPageParam: undefined as string | undefined,
  });

  // ── Build flat list items ───────────────────────────
  // Messages are ordered chronologically (oldest first, newest at bottom).
  // FlashList v2 uses maintainVisibleContentPosition + startRenderingFromBottom
  // to anchor scrolling at the bottom like a chat interface.

  const listItems = useMemo<ListItem[]>(() => {
    if (!data?.pages) return [];

    // Flatten all pages into a single chronological array (oldest first)
    const allMessages: Message[] = [];
    for (const page of data.pages) {
      for (const msg of page) {
        allMessages.push(msg);
      }
    }

    // Deduplicate by id
    const seen = new Set<string>();
    const uniqueMessages: Message[] = [];
    for (const msg of allMessages) {
      if (!seen.has(msg.id)) {
        seen.add(msg.id);
        uniqueMessages.push(msg);
      }
    }

    // Sort oldest first (chronological)
    uniqueMessages.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    // Build list items with date separators and grouping
    const items: ListItem[] = [];
    let prevMessage: Message | undefined;

    for (let i = 0; i < uniqueMessages.length; i++) {
      const msg = uniqueMessages[i]!;

      // Insert date separator if the day changed
      if (!prevMessage || !isSameDay(prevMessage.createdAt, msg.createdAt)) {
        items.push({
          type: 'separator',
          date: formatDateSeparator(msg.createdAt),
          key: `sep-${msg.createdAt.slice(0, 10)}`,
        });
      }

      const isGrouped = shouldGroup(msg, prevMessage);
      items.push({ type: 'message', message: msg, isGrouped });
      prevMessage = msg;
    }

    return items;
  }, [data]);

  // ── Callbacks ───────────────────────────────────────

  const handleReply = useCallback(
    (message: Message) => {
      setReplyingTo(channelId, message);
    },
    [channelId, setReplyingTo],
  );

  const handleEdit = useCallback((_message: Message) => {
    // Edit flow: set editing message in store
    // This will be connected to the composer in the future
  }, []);

  const handleDelete = useCallback(
    async (messageId: string) => {
      try {
        await messagesApi.delete(channelId, messageId);
      } catch {
        // Error handling in production
      }
    },
    [channelId],
  );

  const handleReact = useCallback((_messageId: string) => {
    // Open emoji picker in the future
  }, []);

  const handleLoadOlder = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      // Distance from bottom
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      setShowScrollToBottom(distanceFromBottom > 300);
    },
    [],
  );

  const scrollToBottom = useCallback(() => {
    flashListRef.current?.scrollToEnd({ animated: true });
  }, []);

  // ── Scroll-to-bottom button animation ───────────────

  const scrollButtonOpacity = useSharedValue(0);

  React.useEffect(() => {
    scrollButtonOpacity.value = withTiming(showScrollToBottom ? 1 : 0, {
      duration: 200,
      easing: Easing.inOut(Easing.ease),
    });
  }, [showScrollToBottom, scrollButtonOpacity]);

  const scrollButtonStyle = useAnimatedStyle(() => ({
    opacity: scrollButtonOpacity.value,
    transform: [
      { translateY: scrollButtonOpacity.value === 0 ? 20 : 0 },
    ],
  }));

  // ── Render functions ────────────────────────────────

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ListItem>) => {
      if (item.type === 'separator') {
        return (
          <View style={styles.separatorContainer}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>{item.date}</Text>
            <View style={styles.separatorLine} />
          </View>
        );
      }

      return (
        <MessageItem
          message={item.message}
          isGrouped={item.isGrouped}
          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onReact={handleReact}
          onPressAvatar={onPressAvatar}
          currentUserId={currentUserId}
        />
      );
    },
    [currentUserId, handleReply, handleEdit, handleDelete, handleReact, onPressAvatar],
  );

  const keyExtractor = useCallback((item: ListItem) => {
    if (item.type === 'separator') return item.key;
    return item.message.id;
  }, []);

  const ListFooterComponent = useMemo(
    () => <TypingIndicator channelId={channelId} />,
    [channelId],
  );

  const ListHeaderComponent = useMemo(() => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color={colors.text.muted} />
        </View>
      );
    }
    if (!hasNextPage && listItems.length > 0) {
      return (
        <View style={styles.beginningOfChat}>
          <Text style={styles.beginningText}>
            This is the beginning of the conversation.
          </Text>
        </View>
      );
    }
    return null;
  }, [isFetchingNextPage, hasNextPage, listItems.length]);

  // ── Loading / Error states ──────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load messages</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => refetch()}
          activeOpacity={0.7}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main render ─────────────────────────────────────
  // FlashList v2 uses maintainVisibleContentPosition with startRenderingFromBottom
  // to create a chat-like bottom-anchored scrolling experience.
  // onStartReached fires when scrolling to the top (older messages).

  return (
    <View style={styles.container}>
      <FlashList
        ref={flashListRef}
        data={listItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onStartReached={handleLoadOlder}
        onStartReachedThreshold={0.3}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        maintainVisibleContentPosition={{
          autoscrollToBottomThreshold: 100,
          startRenderingFromBottom: true,
        }}
      />

      {/* Scroll to bottom button */}
      <Animated.View
        style={[styles.scrollToBottomWrapper, scrollButtonStyle]}
        pointerEvents={showScrollToBottom ? 'auto' : 'none'}
      >
        <TouchableOpacity
          style={styles.scrollToBottomButton}
          onPress={scrollToBottom}
          activeOpacity={0.8}
        >
          <Text style={styles.scrollToBottomIcon}>v</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  listContent: {
    paddingBottom: spacing.sm,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
  },

  // ── Date separators ───────────────────────
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  separatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.stroke.primary,
  },
  separatorText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Loading / Error / Empty ───────────────
  loadingMore: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  beginningOfChat: {
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
  },
  beginningText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  retryText: {
    fontSize: fontSize.md,
    color: '#ffffff',
    fontWeight: '600',
  },

  // ── Scroll to bottom ──────────────────────
  scrollToBottomWrapper: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
  },
  scrollToBottomButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.stroke.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  scrollToBottomIcon: {
    fontSize: fontSize.lg,
    color: colors.text.secondary,
    fontWeight: '700',
  },
});
