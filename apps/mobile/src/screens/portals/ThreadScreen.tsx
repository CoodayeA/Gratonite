import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { PortalsStackParamList } from '../../navigation/types';
import { threadsApi, messagesApi } from '../../lib/api';
import { colors, spacing, radius, fontSize } from '../../theme';

type Route = RouteProp<PortalsStackParamList, 'Thread'>;

// ── Message Item ─────────────────────────────────────────────
function MessageItem({ message }: { message: any }) {
  const authorName =
    message.author?.displayName ?? message.author?.username ?? 'Unknown';
  const timestamp = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <View style={messageStyles.container}>
      {/* Avatar placeholder */}
      <View style={messageStyles.avatar}>
        <Text style={messageStyles.avatarText}>
          {authorName.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={messageStyles.body}>
        <View style={messageStyles.headerRow}>
          <Text style={messageStyles.authorName} numberOfLines={1}>
            {authorName}
          </Text>
          <Text style={messageStyles.timestamp}>{timestamp}</Text>
        </View>
        <Text style={messageStyles.content}>{message.content}</Text>
      </View>
    </View>
  );
}

const messageStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.brand.primary,
  },
  body: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: 2,
  },
  authorName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
    flexShrink: 1,
  },
  timestamp: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
  content: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    lineHeight: 22,
  },
});

// ── Message Composer ─────────────────────────────────────────
function MessageComposer({
  channelId,
  onMessageSent,
}: {
  channelId: string;
  onMessageSent: () => void;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;

    setSending(true);
    try {
      await messagesApi.send(channelId, { content });
      setText('');
      onMessageSent();
    } catch {
      // Silently fail - user can retry
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={composerStyles.container}>
      <TextInput
        style={composerStyles.input}
        value={text}
        onChangeText={setText}
        placeholder="Reply in thread..."
        placeholderTextColor={colors.text.muted}
        multiline
        maxLength={2000}
        returnKeyType="send"
        blurOnSubmit={false}
        onSubmitEditing={handleSend}
      />
      <TouchableOpacity
        style={[composerStyles.sendButton, !text.trim() && composerStyles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!text.trim() || sending}
        activeOpacity={0.7}
      >
        {sending ? (
          <ActivityIndicator size="small" color={colors.text.inverse} />
        ) : (
          <Ionicons name="send" size={18} color={colors.text.inverse} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const composerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.stroke.secondary,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: '#25243a',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});

// ── Parent Message Preview ───────────────────────────────────
function ParentMessagePreview({ message }: { message: any | null }) {
  if (!message) return null;

  const authorName =
    message.author?.displayName ?? message.author?.username ?? 'Unknown';

  return (
    <View style={parentStyles.container}>
      <View style={parentStyles.bar} />
      <View style={parentStyles.content}>
        <Text style={parentStyles.author} numberOfLines={1}>
          {authorName}
        </Text>
        <Text style={parentStyles.text} numberOfLines={2}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const parentStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.message.reply,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.secondary,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: colors.brand.primary,
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  author: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.brand.primary,
    marginBottom: 2,
  },
  text: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
});

// ── Main Screen ──────────────────────────────────────────────
export function ThreadScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { threadId, channelId } = route.params;

  const [thread, setThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [parentMessage, setParentMessage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const flatListRef = useRef<FlatList>(null);

  // ── Load thread data ───────────────────────────────────
  const loadThread = useCallback(async () => {
    try {
      const threadData = await threadsApi.get(threadId);
      setThread(threadData);
    } catch {
      setError('Failed to load thread');
    }
  }, [threadId]);

  const loadMessages = useCallback(async () => {
    try {
      // Thread messages are stored in a channel with the thread's id
      const msgs = await messagesApi.list(threadId, { limit: 50 });
      setMessages(msgs.reverse());
    } catch {
      // Silent fail - empty list shown
    }
  }, [threadId]);

  const loadParentMessage = useCallback(async () => {
    const parentId = route.params.parentMessageId;
    if (!parentId) return;
    try {
      // Try loading messages from the parent channel to find the parent message
      const msgs = await messagesApi.list(channelId, { limit: 1 });
      // Try to find the parent message - if not in the first batch, use first message as fallback
      const parent = msgs.find((m: any) => m.id === parentId) ?? null;
      setParentMessage(parent);
    } catch {
      // Parent preview is optional
    }
  }, [channelId, route.params.parentMessageId]);

  // ── Initial load ───────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadThread(), loadMessages(), loadParentMessage()]);
      setLoading(false);
    };
    init();
  }, [loadThread, loadMessages, loadParentMessage]);

  // ── Refresh handler ────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  };

  // ── After sending a message ────────────────────────────
  const handleMessageSent = () => {
    loadMessages().then(() => {
      // Scroll to bottom after new message
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    });
  };

  // ── Render ─────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !thread) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thread</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.text.muted} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadThread}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {thread?.name ?? 'Thread'}
          </Text>
          {thread?.messageCount != null && (
            <Text style={styles.headerSubtitle}>
              {thread.messageCount} {thread.messageCount === 1 ? 'reply' : 'replies'}
            </Text>
          )}
        </View>
        <TouchableOpacity
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => {
            // Thread options menu placeholder
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      {/* Parent message preview */}
      <ParentMessagePreview message={parentMessage} />

      {/* Message list */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageItem message={item} />}
          contentContainerStyle={
            messages.length === 0 ? styles.emptyList : styles.messageList
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.text.muted} />
              <Text style={styles.emptyText}>No replies yet</Text>
              <Text style={styles.emptySubtext}>
                Be the first to reply in this thread
              </Text>
            </View>
          }
          onRefresh={handleRefresh}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
        />

        {/* Composer */}
        <MessageComposer channelId={threadId} onMessageSent={handleMessageSent} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.secondary,
    gap: spacing.md,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginTop: 1,
  },

  // Messages
  messageList: {
    paddingVertical: spacing.sm,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing['2xl'],
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
  },

  // Error
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing['2xl'],
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.text.muted,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.inverse,
  },
});
