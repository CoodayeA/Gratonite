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
import { messages as messagesApi } from '../../lib/api';
import { onMessageCreate, getSocket } from '../../lib/socket';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius } from '../../lib/theme';
import type { Message } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'DirectMessage'>;

export default function DirectMessageScreen({ route }: Props) {
  const { channelId, recipientName } = route.params;
  const { user } = useAuth();
  const [messageList, setMessageList] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await messagesApi.list(channelId, { limit: 50 });
      setMessageList(data.reverse());
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
      setMessageList((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch (err: any) {
      Alert.alert('Error', 'Failed to send message');
      setInputText(text);
    } finally {
      setSending(false);
    }
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
    const isOwn = item.authorId === user?.id;
    const authorName = isOwn
      ? (user?.displayName || user?.username || 'You')
      : (item.author?.displayName || item.author?.username || recipientName);

    const prev = index > 0 ? messageList[index - 1] : null;
    const isGrouped = prev?.authorId === item.authorId &&
      new Date(item.createdAt).getTime() - new Date(prev!.createdAt).getTime() < 5 * 60000;

    return (
      <View style={[styles.messageRow, isGrouped && styles.messageGrouped]}>
        {!isGrouped && (
          <View style={styles.messageHeader}>
            <View style={[styles.msgAvatar, isOwn && styles.msgAvatarOwn]}>
              <Text style={styles.msgAvatarText}>{authorName.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.authorName}>{authorName}</Text>
            <Text style={styles.messageTime}>{formatTime(item.createdAt)}</Text>
          </View>
        )}
        <Text style={styles.messageContent}>{item.content}</Text>
      </View>
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
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubble-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>Start a conversation with {recipientName}</Text>
          </View>
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder={`Message ${recipientName}`}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={4000}
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
    marginLeft: 40,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: 80,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    textAlign: 'center',
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
});
