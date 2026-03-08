import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
import {
  messages as messagesApi,
  reactions as reactionsApi,
  pins as pinsApi,
  bookmarks as bookmarksApi,
  files as filesApi,
  polls as pollsApi,
  guildEmojis as guildEmojisApi,
  channels as channelsApi,
} from '../../lib/api';
import {
  onMessageCreate,
  onMessageUpdate,
  onMessageDelete,
  onTypingStart,
  onMessageReactionAdd,
  onMessageReactionRemove,
  getSocket,
} from '../../lib/socket';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MessageBubble from '../../components/MessageBubble';
import MessageContextMenu from '../../components/MessageContextMenu';
import ReplyBar from '../../components/ReplyBar';
import EditBar from '../../components/EditBar';
import PinnedMessages from '../../components/PinnedMessages';
import ForwardModal from '../../components/ForwardModal';
import EmptyState from '../../components/EmptyState';
import EmojiPicker from '../../components/EmojiPicker';
import StickerBrowser from '../../components/StickerBrowser';
import PollCreateSheet from '../../components/PollCreateSheet';
import PollCard from '../../components/PollCard';
import ScrollToBottomFAB from '../../components/ScrollToBottomFAB';
import SwipeableMessage from '../../components/SwipeableMessage';
import TypingDots from '../../components/TypingDots';
import MessageSkeleton from '../../components/MessageSkeleton';
import ChatBackground from '../../components/ChatBackground';
import { notificationSuccess, lightImpact } from '../../lib/haptics';
import type { Message, ReactionGroup, Sticker, Poll, GuildEmoji } from '../../types';

type Props = any;

const QUICK_EMOJIS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F60E}', '\u{1F525}', '\u{1F389}'];

export default function ChannelChatScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { channelId, channelName, guildId } = route.params;
  const { user } = useAuth();
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const toast = useToast();
  const [messageList, setMessageList] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [showScrollFAB, setShowScrollFAB] = useState(false);
  const initialLoadDone = useRef(false);

  // Typing indicator state
  const [typingUsers, setTypingUsers] = useState<Map<string, { username: string; timeout: ReturnType<typeof setTimeout> }>>(new Map());
  const typingThrottle = useRef<number>(0);

  // Reactions state
  const [messageReactions, setMessageReactions] = useState<Map<string, ReactionGroup[]>>(new Map());
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);

  // Context menu state
  const [contextMenuMessage, setContextMenuMessage] = useState<Message | null>(null);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Edit state
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Pinned messages modal
  const [showPinned, setShowPinned] = useState(false);

  // Forward modal
  const [forwardContent, setForwardContent] = useState<string | null>(null);

  // Emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Sticker browser
  const [showStickerBrowser, setShowStickerBrowser] = useState(false);

  // Poll creator
  const [showPollCreator, setShowPollCreator] = useState(false);

  // Custom emojis for this guild
  const [customEmojis, setCustomEmojis] = useState<GuildEmoji[]>([]);

  // Channel background
  const [bgMedia, setBgMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  // Inverted data: newest first for inverted FlatList
  const invertedData = useMemo(() => [...messageList].reverse(), [messageList]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    messageList: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    loadingMore: {
      paddingVertical: spacing.md,
    },
    chatWrapper: {
      flex: 1,
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
    attachButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
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
    typingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
      backgroundColor: colors.bgSecondary,
      gap: spacing.sm,
    },
    typingText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontStyle: 'italic',
    },
    emojiPicker: {
      flexDirection: 'row',
      marginLeft: 40,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
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
  }), [colors, spacing, fontSize, borderRadius]);

  // Set header with pin and member list buttons
  useEffect(() => {
    navigation?.setOptions?.({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity onPress={() => setShowPinned(true)} style={{ padding: spacing.sm }}>
            <Ionicons name="pin-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            const guildId = route.params?.guildId;
            if (guildId) navigation.navigate('GuildMemberList', { guildId });
          }} style={{ padding: spacing.sm }}>
            <Ionicons name="people-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, route.params?.guildId, colors, spacing]);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await messagesApi.list(channelId, { limit: 50 });
      setMessageList(data.reverse());
      initialLoadDone.current = true;
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load messages');
      }
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Fetch custom emojis for this guild
  useEffect(() => {
    if (guildId) {
      guildEmojisApi.list(guildId).then(setCustomEmojis).catch(() => {});
    }
  }, [guildId]);

  // Fetch channel background
  useEffect(() => {
    channelsApi.get(channelId).then((ch) => {
      if (ch.backgroundUrl) {
        setBgMedia({ url: ch.backgroundUrl, type: ch.backgroundType || 'image' });
      }
    }).catch(() => {});
  }, [channelId]);

  // Socket: new messages
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
  }, [channelId]);

  // Socket: message updates (edits)
  useEffect(() => {
    const unsub = onMessageUpdate((data: any) => {
      if (data.channelId === channelId) {
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
  }, [channelId]);

  // Socket: message deletes
  useEffect(() => {
    const unsub = onMessageDelete((data) => {
      if (data.channelId === channelId) {
        setMessageList((prev) => prev.filter((m) => m.id !== data.id));
      }
    });
    return unsub;
  }, [channelId]);

  // Socket: typing
  useEffect(() => {
    const unsub = onTypingStart((data) => {
      if (data.channelId !== channelId || data.userId === user?.id) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
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

  // Socket: reactions
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

  // Join channel room
  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      socket.emit('CHANNEL_JOIN', { channelId });
      return () => {
        socket.emit('CHANNEL_LEAVE', { channelId });
      };
    }
  }, [channelId]);

  // --- Actions ---

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    // If editing, update the message instead
    if (editingMessage) {
      setSending(true);
      try {
        await messagesApi.edit(channelId, editingMessage.id, text);
        setMessageList((prev) =>
          prev.map((m) =>
            m.id === editingMessage.id
              ? { ...m, content: text, editedAt: new Date().toISOString() }
              : m,
          ),
        );
      } catch {
        toast.error('Failed to edit message');
      } finally {
        setSending(false);
        setEditingMessage(null);
        setInputText('');
      }
      return;
    }

    setSending(true);
    setInputText('');
    try {
      const msg = await messagesApi.send(channelId, text, replyingTo ? { replyToId: replyingTo.id } : undefined);
      setMessageList((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setReplyingTo(null);
      notificationSuccess();
    } catch {
      toast.error('Failed to send message');
      setInputText(text);
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

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setSending(true);
      try {
        const formData = new FormData();
        const filename = asset.uri.split('/').pop() || 'upload.jpg';
        formData.append('file', {
          uri: asset.uri,
          name: filename,
          type: asset.mimeType || 'image/jpeg',
        } as any);
        const uploadRes = await filesApi.upload(formData);
        const msg = await messagesApi.send(channelId, uploadRes.url);
        setMessageList((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      } catch {
        toast.error('There was an error uploading your file.');
      } finally {
        setSending(false);
      }
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    const now = Date.now();
    if (text.length > 0 && now - typingThrottle.current > 3000) {
      typingThrottle.current = now;
      messagesApi.sendTyping(channelId).catch(() => {});
    }
  };

  const handleReactionToggle = async (messageId: string, emoji: string) => {
    lightImpact();
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

  // --- Context menu handlers ---

  const handleReply = (msg: Message) => {
    setReplyingTo(msg);
    setEditingMessage(null);
  };

  const handleEdit = (msg: Message) => {
    setEditingMessage(msg);
    setInputText(msg.content);
    setReplyingTo(null);
  };

  const handleDelete = (msg: Message) => {
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await messagesApi.delete(channelId, msg.id);
            setMessageList((prev) => prev.filter((m) => m.id !== msg.id));
          } catch {
            toast.error('Failed to delete message');
          }
        },
      },
    ]);
  };

  const handlePin = async (msg: Message) => {
    try {
      await pinsApi.add(channelId, msg.id);
      setMessageList((prev) => prev.map((m) => m.id === msg.id ? { ...m, pinned: true } : m));
      toast.success('Message has been pinned.');
    } catch {
      toast.error('Failed to pin message');
    }
  };

  const handleUnpin = async (msg: Message) => {
    try {
      await pinsApi.remove(channelId, msg.id);
      setMessageList((prev) => prev.map((m) => m.id === msg.id ? { ...m, pinned: false } : m));
      toast.success('Message unpinned.');
    } catch {
      toast.error('Failed to unpin message');
    }
  };

  const handleReact = (msg: Message) => {
    setReactionPickerMessageId(reactionPickerMessageId === msg.id ? null : msg.id);
  };

  const handleBookmark = async (msg: Message) => {
    try {
      await bookmarksApi.create(msg.id);
      toast.success('Message bookmarked.');
    } catch {
      toast.error('Failed to bookmark message');
    }
  };

  const handleForward = (msg: Message) => {
    setForwardContent(msg.content);
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  const handleAttachPress = () => {
    Alert.alert('Attach', 'What would you like to add?', [
      { text: 'Image / Video', onPress: handlePickImage },
      { text: 'Poll', onPress: () => setShowPollCreator(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePollVote = async (pollId: string, optionId: string) => {
    try {
      await pollsApi.vote(pollId, optionId);
    } catch {
      toast.error('Failed to vote');
    }
  };

  const handlePollRemoveVote = async (pollId: string) => {
    try {
      await pollsApi.removeVote(pollId);
    } catch {
      toast.error('Failed to remove vote');
    }
  };

  const handleStickerSelect = async (sticker: Sticker) => {
    try {
      const msg = await messagesApi.send(channelId, ' ', { stickerId: sticker.id });
      setMessageList((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch {
      toast.error('Failed to send sticker');
    }
  };

  // --- Render ---

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    // With inverted list, data is newest-first. index+1 is the chronologically older message.
    const olderMsg = index < invertedData.length - 1 ? invertedData[index + 1] : null;
    const isGrouped = olderMsg?.authorId === item.authorId &&
      new Date(item.createdAt).getTime() - new Date(olderMsg!.createdAt).getTime() < 5 * 60000;
    const isOwn = item.authorId === user?.id;
    const rxns = messageReactions.get(item.id) ?? [];
    const showPicker = reactionPickerMessageId === item.id;
    const isNew = initialLoadDone.current;

    // Build reply preview if message has replyTo
    const replyPreview = item.replyTo
      ? {
          authorName: item.replyTo.author?.displayName || item.replyTo.author?.username || 'Unknown',
          content: item.replyTo.content || '',
        }
      : null;

    return (
      <SwipeableMessage onReply={() => handleReply(item)}>
        <View>
          <MessageBubble
            message={item}
            isOwn={isOwn}
            isGrouped={isGrouped}
            reactions={rxns}
            replyPreview={replyPreview}
            onLongPress={() => setContextMenuMessage(item)}
            onReactionToggle={(emoji) => handleReactionToggle(item.id, emoji)}
            onReactionAdd={() => handleReact(item)}
            poll={(item as any).poll}
            onPollVote={handlePollVote}
            onPollRemoveVote={handlePollRemoveVote}
            isNewMessage={isNew}
            customEmojis={customEmojis}
          />

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
        </View>
      </SwipeableMessage>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <MessageSkeleton />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
    >
      <View style={styles.chatWrapper}>
        {bgMedia && <ChatBackground url={bgMedia.url} type={bgMedia.type} />}
        <FlatList
          ref={flatListRef}
          data={invertedData}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          inverted
          keyboardDismissMode="interactive"
          scrollEventThrottle={16}
          onScroll={(e) => setShowScrollFAB(e.nativeEvent.contentOffset.y > 200)}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={styles.loadingMore} color={colors.accentPrimary} />
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="chatbubble-outline"
              title="No messages yet"
              subtitle="Be the first to send a message!"
            />
          }
        />
        <ScrollToBottomFAB
          visible={showScrollFAB}
          onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
        />
      </View>

      {/* Typing indicator */}
      {typingUsers.size > 0 && (
        <View style={styles.typingBar}>
          <TypingDots />
          <Text style={styles.typingText}>
            {Array.from(typingUsers.values()).map((t) => t.username).join(', ')}{' '}
            {typingUsers.size === 1 ? 'is' : 'are'} typing
          </Text>
        </View>
      )}

      {/* Reply bar */}
      {replyingTo && (
        <ReplyBar
          username={replyingTo.author?.displayName || replyingTo.author?.username || 'Unknown'}
          onClose={() => setReplyingTo(null)}
        />
      )}

      {/* Edit bar */}
      {editingMessage && (
        <EditBar onClose={() => { setEditingMessage(null); setInputText(''); }} />
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.attachButton} onPress={handleAttachPress} disabled={sending}>
          <Ionicons name="add" size={24} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={() => setShowEmojiPicker(true)}
        >
          <Ionicons name="happy-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={() => setShowStickerBrowser(true)}
        >
          <Ionicons name="pricetag-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={handleInputChange}
          placeholder={editingMessage ? 'Edit message...' : `Message #${channelName}`}
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
            name={editingMessage ? 'checkmark' : 'send'}
            size={20}
            color={inputText.trim() && !sending ? colors.white : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelect={handleEmojiSelect}
      />

      <StickerBrowser
        visible={showStickerBrowser}
        onClose={() => setShowStickerBrowser(false)}
        guildId={route.params.guildId}
        onSelect={handleStickerSelect}
      />

      {/* Context menu */}
      {contextMenuMessage && (
        <MessageContextMenu
          visible={!!contextMenuMessage}
          onClose={() => setContextMenuMessage(null)}
          message={contextMenuMessage}
          isOwn={contextMenuMessage.authorId === user?.id}
          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPin={handlePin}
          onUnpin={handleUnpin}
          onReact={handleReact}
          onBookmark={handleBookmark}
          onForward={handleForward}
        />
      )}

      {/* Pinned messages */}
      <PinnedMessages
        visible={showPinned}
        onClose={() => setShowPinned(false)}
        channelId={channelId}
      />

      {/* Forward modal */}
      {forwardContent !== null && (
        <ForwardModal
          visible={forwardContent !== null}
          onClose={() => setForwardContent(null)}
          messageContent={forwardContent}
        />
      )}

      <PollCreateSheet
        visible={showPollCreator}
        onClose={() => setShowPollCreator(false)}
        channelId={channelId}
      />
    </KeyboardAvoidingView>
  );
}
