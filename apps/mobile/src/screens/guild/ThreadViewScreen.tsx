import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { threads as threadsApi, messages as messagesApi } from '../../lib/api';
import {
  onMessageCreate,
  onMessageUpdate,
  onMessageDelete,
  getSocket,
} from '../../lib/socket';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MessageBubble from '../../components/MessageBubble';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import LoadErrorCard from '../../components/LoadErrorCard';
import type { Message } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'ThreadView'>;

export default function ThreadViewScreen({ route }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { threadId, threadName } = route.params;
  const { user } = useAuth();
  const [messageList, setMessageList] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const isNearBottomRef = useRef(true);
  const hasDataRef = useRef(false);

  const fetchMessages = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await threadsApi.getMessages(threadId);
      setMessageList(data.reverse());
      hasDataRef.current = true;
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load thread messages';
        if (hasDataRef.current) {
          toast.error(message);
        } else {
          setLoadError(message);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Socket: join/leave thread channel room
  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      socket.emit('CHANNEL_JOIN', { channelId: threadId });
      return () => {
        socket.emit('CHANNEL_LEAVE', { channelId: threadId });
      };
    }
  }, [threadId]);

  // Socket: new messages
  useEffect(() => {
    const unsub = onMessageCreate((data: any) => {
      if (data.channelId === threadId) {
        // Skip if this is our own message (optimistic send already added it)
        if (data.authorId === user?.id) return;
        const msg: Message = {
          id: data.id,
          channelId: data.channelId,
          authorId: data.authorId,
          content: data.content,
          type: data.type ?? 0,
          createdAt: data.createdAt,
          editedAt: null,
          author: data.author,
          attachments: Array.isArray(data.attachments) ? data.attachments : undefined,
          replyToId: data.replyToId,
          replyTo: data.replyTo,
        };
        setMessageList((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });
    return unsub;
  }, [threadId, user?.id]);

  // Socket: message edits
  useEffect(() => {
    const unsub = onMessageUpdate((data: any) => {
      if (data.channelId === threadId) {
        setMessageList((prev) =>
          prev.map((m) =>
            m.id === data.id
              ? { ...m, content: data.content, editedAt: data.editedAt || new Date().toISOString() }
              : m,
          ),
        );
      }
    });
    return unsub;
  }, [threadId]);

  // Socket: message deletes
  useEffect(() => {
    const unsub = onMessageDelete((data) => {
      if (data.channelId === threadId) {
        setMessageList((prev) => prev.filter((m) => m.id !== data.id));
      }
    });
    return unsub;
  }, [threadId]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText('');
    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      channelId: threadId,
      authorId: user?.id || 'me',
      content: text,
      type: 0,
      createdAt: new Date().toISOString(),
      editedAt: null,
      author: user ? {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarHash: user.avatarHash,
      } : undefined,
    };
    setMessageList((prev) => [...prev, optimisticMessage]);
    try {
      const msg = await messagesApi.send(threadId, text);
      setMessageList((prev) => {
        if (prev.some((m) => m.id === msg.id)) {
          return prev.filter((m) => m.id !== optimisticId);
        }
        return prev.map((m) => m.id === optimisticId ? msg : m);
      });
    } catch {
      toast.error('Failed to send reply');
      setMessageList((prev) => prev.filter((m) => m.id !== optimisticId));
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const prev = index > 0 ? messageList[index - 1] : null;
    const isGrouped =
      prev?.authorId === item.authorId &&
      new Date(item.createdAt).getTime() - new Date(prev!.createdAt).getTime() < 5 * 60000;
    const isOwn = item.authorId === user?.id;

    return <MessageBubble message={item} isOwn={isOwn} isGrouped={isGrouped} />;
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    messageList: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      flexGrow: 1,
      justifyContent: 'flex-end',
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
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (loadError && messageList.length === 0) return <LoadErrorCard title="Failed to load thread" message={loadError} onRetry={() => { setLoading(true); fetchMessages(); }} />;

  return (
    <PatternBackground>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messageList}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => {
          if (isNearBottomRef.current) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
          isNearBottomRef.current = distanceFromBottom < 150;
        }}
        scrollEventThrottle={16}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-outline"
            title="No replies yet"
            subtitle="Be the first to reply in this thread!"
          />
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder={`Reply in ${threadName}`}
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
          accessibilityLabel="Send message"
        >
          <Ionicons
            name="send"
            size={20}
            color={inputText.trim() && !sending ? colors.white : colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </PatternBackground>
  );
}
