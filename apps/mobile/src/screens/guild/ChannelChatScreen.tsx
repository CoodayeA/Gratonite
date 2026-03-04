import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { messages as messagesApi, reactions as reactionsApi } from '../../lib/api';
import {
  onMessageCreate,
  onTypingStart,
  onMessageReactionAdd,
  onMessageReactionRemove,
  getSocket,
} from '../../lib/socket';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius } from '../../lib/theme';
import type { Message, ReactionGroup } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ChannelChat'>;

// Common emojis for the quick-reaction picker
const QUICK_EMOJIS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F60E}', '\u{1F525}', '\u{1F389}'];

export default function ChannelChatScreen({ route }: Props) {
  const { channelId, channelName } = route.params;
  const { user } = useAuth();
  const [messageList, setMessageList] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Typing indicator state
  const [typingUsers, setTypingUsers] = useState<Map<string, { username: string; timeout: ReturnType<typeof setTimeout> }>>(new Map());
  const typingThrottle = useRef<number>(0);

  // Reactions state: messageId -> ReactionGroup[]
  const [messageReactions, setMessageReactions] = useState<Map<string, ReactionGroup[]>>(new Map());

  // Reaction picker state
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await messagesApi.list(channelId, { limit: 50 });
      setMessageList(data.reverse()); // API returns newest first, we want oldest first
    } catch (err: any) {
      if (err.status !== 401) {
        Alert.alert('Error', 'Failed to load messages');
      }
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Listen for new messages via socket
  useEffect(() => {
    const unsub = onMessageCreate((data: any) => {
      if (data.channelId === channelId) {
        const msg: Message = {
          id: data.id,
          channelId: data.channelId,
          authorId: data.authorId,
          content: data.content,
          type: data.type ?? 0,
          createdAt: data.createdAt,
          editedAt: null,
          author: data.author,
        };
        setMessageList((prev) => [...prev, msg]);
      }
    });
    return unsub;
  }, [channelId]);

  // Listen for typing events
  useEffect(() => {
    const unsub = onTypingStart((data) => {
      if (data.channelId !== channelId || data.userId === user?.id) return;

      setTypingUsers((prev) => {
        const next = new Map(prev);
        // Clear existing timeout for this user
        const existing = next.get(data.userId);
        if (existing) clearTimeout(existing.timeout);

        const timeout = setTimeout(() => {
          setTypingUsers((p) => {
            const n = new Map(p);
            n.delete(data.userId);
            return n;
          });
        }, 5000);

        next.set(data.userId, { username: data.username, timeout });
        return next;
      });
    });
    return unsub;
  }, [channelId, user?.id]);

  // Listen for reaction add/remove via socket
  useEffect(() => {
    const unsubAdd = onMessageReactionAdd((data) => {
      if (data.channelId !== channelId) return;
      setMessageReactions((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.messageId) ?? [];
        const idx = existing.findIndex((r) => r.emoji === data.emoji);
        if (idx >= 0) {
          const updated = [...existing];
          updated[idx] = {
            ...updated[idx],
            count: updated[idx].count + 1,
            userIds: [...updated[idx].userIds, data.userId],
            me: updated[idx].me || data.userId === user?.id,
          };
          next.set(data.messageId, updated);
        } else {
          next.set(data.messageId, [
            ...existing,
            { emoji: data.emoji, count: 1, userIds: [data.userId], me: data.userId === user?.id },
          ]);
        }
        return next;
      });
    });

    const unsubRemove = onMessageReactionRemove((data) => {
      if (data.channelId !== channelId) return;
      setMessageReactions((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.messageId) ?? [];
        const updated = existing
          .map((r) => {
            if (r.emoji !== data.emoji) return r;
            return {
              ...r,
              count: r.count - 1,
              userIds: r.userIds.filter((id) => id !== data.userId),
              me: data.userId === user?.id ? false : r.me,
            };
          })
          .filter((r) => r.count > 0);
        next.set(data.messageId, updated);
        return next;
      });
    });

    return () => { unsubAdd(); unsubRemove(); };
  }, [channelId, user?.id]);

  // Join the channel room for socket events
  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      socket.emit('CHANNEL_JOIN', { channelId });
      return () => {
        socket.emit('CHANNEL_LEAVE', { channelId });
      };
    }
  }, [channelId]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText('');
    try {
      const msg = await messagesApi.send(channelId, text);
      // Don't add locally — socket will deliver it (or we add it if no socket msg arrives)
      // Actually for safety, check if it already arrived via socket
      setMessageList((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch (err: any) {
      Alert.alert('Error', 'Failed to send message');
      setInputText(text); // Restore input on failure
    } finally {
      setSending(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || messageList.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messageList[0];
      const more = await messagesApi.list(channelId, { before: oldest.id, limit: 50 });
      if (more.length > 0) {
        setMessageList((prev) => [...more.reverse(), ...prev]);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  // Send typing indicator (throttled to every 3s)
  const handleInputChange = (text: string) => {
    setInputText(text);
    const now = Date.now();
    if (text.length > 0 && now - typingThrottle.current > 3000) {
      typingThrottle.current = now;
      messagesApi.sendTyping(channelId).catch(() => {});
    }
  };

  // Toggle a reaction on a message
  const handleReactionToggle = async (messageId: string, emoji: string) => {
    const existing = messageReactions.get(messageId) ?? [];
    const reaction = existing.find((r) => r.emoji === emoji);
    try {
      if (reaction?.me) {
        await reactionsApi.remove(channelId, messageId, emoji);
      } else {
        await reactionsApi.add(channelId, messageId, emoji);
      }
    } catch {
      // ignore
    }
    setReactionPickerMessageId(null);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const prev = index > 0 ? messageList[index - 1] : null;
    const isGrouped = prev?.authorId === item.authorId &&
      new Date(item.createdAt).getTime() - new Date(prev!.createdAt).getTime() < 5 * 60000;
    const isOwn = item.authorId === user?.id;
    const authorName = item.author?.displayName || item.author?.username || item.authorId.slice(0, 8);
    const rxns = messageReactions.get(item.id) ?? [];
    const showPicker = reactionPickerMessageId === item.id;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => setReactionPickerMessageId(showPicker ? null : item.id)}
        style={[styles.messageRow, isGrouped && styles.messageGrouped]}
      >
        {!isGrouped && (
          <View style={styles.messageHeader}>
            <View style={[styles.msgAvatar, isOwn && styles.msgAvatarOwn]}>
              <Text style={styles.msgAvatarText}>{authorName.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.authorName}>{authorName}</Text>
            <Text style={styles.messageTime}>{formatTime(item.createdAt)}</Text>
          </View>
        )}
        <Text style={[styles.messageContent, isGrouped && styles.messageContentGrouped]}>
          {item.content}
        </Text>

        {/* Reaction display */}
        {rxns.length > 0 && (
          <View style={styles.reactionsRow}>
            {rxns.map((r) => (
              <TouchableOpacity
                key={r.emoji}
                style={[styles.reactionChip, r.me && styles.reactionChipActive]}
                onPress={() => handleReactionToggle(item.id, r.emoji)}
              >
                <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                <Text style={[styles.reactionCount, r.me && styles.reactionCountActive]}>{r.count}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.reactionAddBtn}
              onPress={() => setReactionPickerMessageId(showPicker ? null : item.id)}
            >
              <Ionicons name="add-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Quick emoji picker */}
        {showPicker && (
          <View style={styles.emojiPicker}>
            {QUICK_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.emojiPickerBtn}
                onPress={() => handleReactionToggle(item.id, emoji)}
              >
                <Text style={styles.emojiPickerText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messageList}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onEndReachedThreshold={0.1}
        inverted={false}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }}
        ListHeaderComponent={
          loadingMore ? (
            <ActivityIndicator style={styles.loadingMore} color={colors.accentPrimary} />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubble-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Be the first to send a message!</Text>
          </View>
        }
      />

      {/* Typing indicator */}
      {typingUsers.size > 0 && (
        <View style={styles.typingBar}>
          <Text style={styles.typingText}>
            {Array.from(typingUsers.values()).map((t) => t.username).join(', ')}{' '}
            {typingUsers.size === 1 ? 'is' : 'are'} typing...
          </Text>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={handleInputChange}
          placeholder={`Message #${channelName}`}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={4000}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          <Ionicons
            name="send"
            size={20}
            color={inputText.trim() && !sending ? colors.white : colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
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
  msgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgAvatarOwn: {
    backgroundColor: colors.accentPrimary,
  },
  msgAvatarText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
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
  messageContent: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    lineHeight: 22,
    marginLeft: 40, // aligned with text after avatar
  },
  messageContentGrouped: {
    marginLeft: 40,
  },
  loadingMore: {
    paddingVertical: spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: 80,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.bgElevated,
  },
  // Typing indicator
  typingBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: colors.bgSecondary,
  },
  typingText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },
  // Reactions
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
  // Emoji picker
  emojiPicker: {
    flexDirection: 'row',
    marginLeft: 40,
    marginTop: spacing.xs,
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  emojiPickerBtn: {
    padding: spacing.xs,
  },
  emojiPickerText: {
    fontSize: fontSize.xl,
  },
});
