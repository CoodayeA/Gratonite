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
  bookmarks as bookmarksApi,
  files as filesApi,
  drafts as draftsApi,
  translation as translationApi,
  textReactions as textReactionsApi,
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
import { useTheme, useGlass } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MessageBubble from '../../components/MessageBubble';
import MessageContextMenu from '../../components/MessageContextMenu';
import ReplyBar from '../../components/ReplyBar';
import EditBar from '../../components/EditBar';
import ForwardModal from '../../components/ForwardModal';
import EmptyState from '../../components/EmptyState';
import EmojiPicker from '../../components/EmojiPicker';
import WhoReactedSheet from '../../components/WhoReactedSheet';
import TextReactionSheet from '../../components/TextReactionSheet';
import ScrollToBottomFAB from '../../components/ScrollToBottomFAB';
import SwipeableMessage from '../../components/SwipeableMessage';
import TypingDots from '../../components/TypingDots';
import MessageSkeleton from '../../components/MessageSkeleton';
import { useE2E } from '../../hooks/useE2E';
import { securityStore } from '../../lib/securityStore';
import { channels as channelsApi } from '../../lib/api';
import DisappearSettingsSheet from '../../components/DisappearSettingsSheet';
import DisappearTimer from '../../components/DisappearTimer';
import * as ScreenCapture from 'expo-screen-capture';
import { cacheMessages, getCachedMessages, queueSend, getPendingQueue, removePending } from '../../lib/offlineDb';
import { useIsOnline } from '../../components/OfflineBanner';
import { mediumImpact, lightImpact } from '../../lib/haptics';
import { playSound } from '../../lib/soundEngine';
import type { Message, ReactionGroup, TextReactionGroup } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'DirectMessage'>;

const QUICK_EMOJIS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F60E}', '\u{1F525}', '\u{1F389}'];

export default function DirectMessageScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { channelId, recipientName, recipientId, isGroupDm } = route.params;
  const { user } = useAuth();
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const glass = useGlass();
  const toast = useToast();
  const isOnline = useIsOnline();

  // Group DM participant IDs (for E2E group key distribution)
  const [groupParticipantIds, setGroupParticipantIds] = useState<string[] | undefined>(undefined);

  // E2E Encryption
  const { e2eKey, isE2EReady, encryptMessage, decryptMessage } = useE2E({
    userId: user?.id,
    channelId,
    recipientId,
    isGroupDm,
    groupParticipantIds,
  });
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, string>>(new Map());

  // Disappearing messages
  const [disappearTimer, setDisappearTimer] = useState<number | null>(null);
  const [showDisappearSheet, setShowDisappearSheet] = useState(false);

  // Incognito keyboard
  const [incognitoKeyboard, setIncognitoKeyboard] = useState(false);

  const [messageList, setMessageList] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const [showScrollFAB, setShowScrollFAB] = useState(false);
  const initialLoadDone = useRef(false);

  // Typing
  const [typingUsers, setTypingUsers] = useState<Map<string, { username: string; timeout: ReturnType<typeof setTimeout> }>>(new Map());
  const typingThrottle = useRef<number>(0);

  // Reactions
  const [messageReactions, setMessageReactions] = useState<Map<string, ReactionGroup[]>>(new Map());
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);

  // Context menu
  const [contextMenuMessage, setContextMenuMessage] = useState<Message | null>(null);

  // Reply / Edit
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Forward
  const [forwardContent, setForwardContent] = useState<string | null>(null);

  // Emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Drafts
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Who reacted sheet
  const [whoReactedData, setWhoReactedData] = useState<{ users: Array<{ id: string; username?: string }>; emoji: string } | null>(null);

  // Text reactions
  const [textReactionsMap, setTextReactionsMap] = useState<Map<string, TextReactionGroup[]>>(new Map());
  const [textReactMessage, setTextReactMessage] = useState<Message | null>(null);

  // Inverted data: newest first
  const invertedData = useMemo(() => [...messageList].reverse(), [messageList]);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await messagesApi.list(channelId, { limit: 50 });
      const reversed = data.reverse();
      setMessageList(reversed);
      setHasMoreHistory(data.length >= 50);
      cacheMessages(channelId, reversed).catch(() => {});
      initialLoadDone.current = true;
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load messages');
      }
      getCachedMessages(channelId).then(cached => {
        if (cached.length > 0) {
          setMessageList(cached);
          setHasMoreHistory(cached.length >= 50);
        }
      });
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Load draft on mount
  useEffect(() => {
    try {
      draftsApi.get(channelId).then((draft) => {
        if (draft?.content) setInputText(draft.content);
      }).catch(() => {});
    } catch {}
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
          attachments: Array.isArray(data.attachments) ? data.attachments : undefined,
          replyToId: data.replyToId,
          replyTo: data.replyTo,
          isEncrypted: data.isEncrypted,
          encryptedContent: data.encryptedContent,
        };
        setMessageList((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (data.authorId !== user?.id) {
          playSound('messageReceive');
        }
      }
    });
    return unsub;
  }, [channelId, user?.id]);

  // Socket: message edits
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

  // Flush pending offline queue when reconnecting
  useEffect(() => {
    if (!isOnline) return;
    (async () => {
      const pending = await getPendingQueue();
      for (const item of pending) {
        if (item.channelId === channelId) {
          try {
            const sendOpts: any = {};
            if (item.isEncrypted && item.encryptedContent) {
              sendOpts.isEncrypted = true;
              sendOpts.encryptedContent = item.encryptedContent;
            }
            await messagesApi.send(item.channelId, item.isEncrypted ? '' : item.content, sendOpts);
            await removePending(item.id);
          } catch { break; }
        }
      }
    })();
  }, [isOnline, channelId]);

  // Decrypt encrypted messages when e2eKey becomes available
  useEffect(() => {
    if (!e2eKey) return;
    const decryptAll = async () => {
      const newDecrypted = new Map(decryptedMessages);
      for (const msg of messageList) {
        if (msg.isEncrypted && msg.encryptedContent && !newDecrypted.has(msg.id)) {
          try {
            const plaintext = await decryptMessage(msg.encryptedContent);
            newDecrypted.set(msg.id, plaintext);
          } catch {
            newDecrypted.set(msg.id, '[Decryption failed]');
          }
        }
      }
      setDecryptedMessages(newDecrypted);
    };
    decryptAll();
  }, [e2eKey, messageList]);

  // Fetch group DM participants for E2E key distribution
  useEffect(() => {
    if (!isGroupDm) return;
    channelsApi.get(channelId).then((ch: any) => {
      if (ch.recipients) {
        setGroupParticipantIds(ch.recipients.map((r: any) => r.id));
      }
    }).catch(() => {});
  }, [channelId, isGroupDm]);

  // Fetch disappear timer
  useEffect(() => {
    channelsApi.get(channelId).then((ch) => {
      if (ch.disappearTimer) setDisappearTimer(ch.disappearTimer);
    }).catch(() => {});
  }, [channelId]);

  // Load incognito keyboard pref
  useEffect(() => {
    securityStore.getIncognitoKeyboard().then(setIncognitoKeyboard).catch(() => {});
  }, []);

  // Screenshot detection — notify other party
  useEffect(() => {
    const subscription = ScreenCapture.addScreenshotListener(() => {
      const socket = getSocket();
      if (socket) {
        socket.emit('SCREENSHOT_TAKEN', { channelId });
      }
    });
    // Listen for partner's screenshots
    const socket = getSocket();
    const handleScreenshot = (data: { channelId: string; userId: string }) => {
      if (data.channelId === channelId && data.userId !== user?.id) {
        toast.info('The other person took a screenshot');
      }
    };
    socket?.on('SCREENSHOT_TAKEN', handleScreenshot);
    return () => {
      subscription.remove();
      socket?.off('SCREENSHOT_TAKEN', handleScreenshot);
    };
  }, [channelId, user?.id]);

  // Header: disappearing messages timer button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setShowDisappearSheet(true)} style={{ padding: 8 }} accessibilityLabel="Disappearing messages">
          <Ionicons name="time-outline" size={22} color={disappearTimer ? colors.accentPrimary : colors.textMuted} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, disappearTimer, colors]);

  // --- Actions ---

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

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

    if (!isOnline) {
      const encrypted = await encryptMessage(text);
      await queueSend(channelId, text, encrypted.isEncrypted ? { isEncrypted: true, encryptedContent: encrypted.encryptedContent! } : undefined);
      setInputText('');
      toast.info('Message queued - will send when online');
      return;
    }

    setSending(true);
    setInputText('');
    try {
      const encrypted = await encryptMessage(text);
      const sendOpts: any = { ...(replyingTo ? { replyToId: replyingTo.id } : {}) };
      if (encrypted.isEncrypted) {
        sendOpts.isEncrypted = true;
        sendOpts.encryptedContent = encrypted.encryptedContent;
      }
      const msg = await messagesApi.send(channelId, encrypted.isEncrypted ? '' : text, sendOpts);
      setMessageList((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setReplyingTo(null);
      draftsApi.delete(channelId).catch(() => {});
      mediumImpact();
      playSound('messageSend');
    } catch {
      toast.error('Failed to send message');
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMoreHistory || messageList.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messageList[0];
      const more = await messagesApi.list(channelId, { before: oldest.id, limit: 50 });
      if (more.length > 0) {
        setMessageList((prev) => [...more.reverse(), ...prev]);
      }
      if (more.length < 50) {
        setHasMoreHistory(false);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Photo library access is required to send images');
      return;
    }
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
    // Debounced draft save
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      if (text.trim()) {
        draftsApi.save(channelId, text).catch(() => {});
      }
    }, 500);
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

  // Context menu handlers

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
    toast.info('Pinning is not available in DMs.');
  };

  const handleUnpin = async (msg: Message) => {
    toast.info('Unpinning is not available in DMs.');
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

  const handleTranslate = async (msg: Message) => {
    try {
      const result = await translationApi.translate(channelId, msg.id);
      Alert.alert('Translation', result.translatedContent);
    } catch (err: any) {
      toast.error(err.message || 'Translation failed');
    }
  };

  const handleReactionLongPress = (messageId: string, emoji: string) => {
    const rxns = messageReactions.get(messageId) ?? [];
    const reaction = rxns.find((r) => r.emoji === emoji);
    if (reaction) {
      setWhoReactedData({
        users: reaction.userIds.map((id) => ({ id })),
        emoji,
      });
    }
  };

  const handleTextReact = (msg: Message) => {
    setTextReactMessage(msg);
  };

  const handleTextReactSubmit = async (text: string) => {
    if (!textReactMessage) return;
    try {
      await textReactionsApi.add(channelId, textReactMessage.id, text);
      setTextReactionsMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(textReactMessage.id) ?? [];
        const idx = existing.findIndex((tr) => tr.text === text);
        if (idx >= 0) {
          const updated = [...existing];
          updated[idx] = { ...updated[idx], count: updated[idx].count + 1, me: true };
          next.set(textReactMessage.id, updated);
        } else {
          next.set(textReactMessage.id, [...existing, { text, count: 1, userIds: [user?.id || ''], me: true }]);
        }
        return next;
      });
    } catch {
      toast.error('Failed to add text reaction');
    }
  };

  const handleTextReactionToggle = async (messageId: string, text: string) => {
    const existing = textReactionsMap.get(messageId) ?? [];
    const tr = existing.find((t) => t.text === text);
    try {
      if (tr?.me) {
        await textReactionsApi.remove(channelId, messageId, text);
        setTextReactionsMap((prev) => {
          const next = new Map(prev);
          const curr = next.get(messageId) ?? [];
          const updated = curr.map((t) => t.text === text ? { ...t, count: t.count - 1, me: false } : t).filter((t) => t.count > 0);
          next.set(messageId, updated);
          return next;
        });
      } else {
        await textReactionsApi.add(channelId, messageId, text);
        setTextReactionsMap((prev) => {
          const next = new Map(prev);
          const curr = next.get(messageId) ?? [];
          const idx = curr.findIndex((t) => t.text === text);
          if (idx >= 0) {
            const updated = [...curr];
            updated[idx] = { ...updated[idx], count: updated[idx].count + 1, me: true };
            next.set(messageId, updated);
          }
          return next;
        });
      }
    } catch {
      // ignore
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

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
    emptyStateWrapper: {
      transform: [{ scaleY: -1 }],
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
      gap: spacing.sm,
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderTopWidth: 1,
        borderTopColor: glass.glassBorder,
      } : neo ? {
        backgroundColor: colors.bgSecondary,
        borderTopWidth: neo.borderWidth,
        borderTopColor: colors.border,
      } : {
        backgroundColor: colors.bgSecondary,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }),
    },
    attachButton: {
      width: 40,
      height: 40,
      borderRadius: neo ? 0 : 20,
      backgroundColor: glass ? glass.glassBackground : colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
      ...(glass ? { borderWidth: 1, borderColor: glass.glassBorder } : {}),
    },
    textInput: {
      flex: 1,
      backgroundColor: glass ? glass.glassBackground : colors.inputBg,
      borderRadius: neo ? 0 : borderRadius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: colors.textPrimary,
      maxHeight: 120,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
      ...(glass ? { borderWidth: 1, borderColor: glass.glassBorder } : {}),
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: neo ? 0 : 20,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      ...(neo ? {
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
        shadowColor: neo.shadowColor,
        shadowOffset: neo.shadowOffset,
        shadowOpacity: neo.shadowOpacity,
        shadowRadius: neo.shadowRadius,
      } : {}),
    },
    sendButtonDisabled: {
      backgroundColor: colors.bgElevated,
    },
    typingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
      backgroundColor: glass ? glass.glassBackground : colors.bgSecondary,
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
      backgroundColor: glass ? glass.glassBackground : colors.bgElevated,
      borderRadius: neo ? 0 : borderRadius.lg,
      padding: spacing.xs,
      gap: spacing.xs,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
      ...(glass ? { borderWidth: 1, borderColor: glass.glassBorder } : {}),
    },
    emojiPickerBtn: {
      padding: spacing.xs,
    },
    emojiPickerText: {
      fontSize: fontSize.xl,
    },
  }), [colors, spacing, fontSize, borderRadius, neo, glass]);

  // --- Render ---

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    // With inverted list, data is newest-first. index+1 is the chronologically older message.
    const olderMsg = index < invertedData.length - 1 ? invertedData[index + 1] : null;
    const isGrouped = olderMsg?.authorId === item.authorId &&
      new Date(item.createdAt).getTime() - new Date(olderMsg!.createdAt).getTime() < 5 * 60000;
    const isOwn = item.authorId === user?.id;
    const rxns = messageReactions.get(item.id) ?? [];
    const txtRxns = textReactionsMap.get(item.id) ?? [];
    const showPicker = reactionPickerMessageId === item.id;
    const isNew = initialLoadDone.current;

    const resolvedContent = item.isEncrypted
      ? (decryptedMessages.get(item.id) ?? (e2eKey ? 'Decrypting...' : '[Encrypted]'))
      : item.content;

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
            isNewMessage={isNew}
            onReactionLongPress={(emoji) => handleReactionLongPress(item.id, emoji)}
            textReactions={txtRxns}
            onTextReactionToggle={(text) => handleTextReactionToggle(item.id, text)}
            isEncrypted={item.isEncrypted}
            decryptedContent={item.isEncrypted ? resolvedContent : undefined}
            channelDisappearTimer={disappearTimer}
          />

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
    <PatternBackground>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
    >
      <View style={styles.chatWrapper}>
        <FlatList
          ref={flatListRef}
          data={invertedData}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          inverted
          keyboardDismissMode="interactive"
          scrollEventThrottle={16}
          maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
          onScroll={(e) => setShowScrollFAB(e.nativeEvent.contentOffset.y > 200)}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore && hasMoreHistory ? (
              <ActivityIndicator style={styles.loadingMore} color={colors.accentPrimary} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyStateWrapper}>
              <EmptyState
                icon="chatbubble-outline"
                title={`Start a conversation with ${recipientName}`}
                subtitle="Send a message to get started"
              />
            </View>
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
        <TouchableOpacity style={styles.attachButton} onPress={handlePickImage} disabled={sending} accessibilityRole="button" accessibilityLabel="Attach file">
          <Ionicons name="add" size={24} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={() => setShowEmojiPicker(true)}
          accessibilityRole="button"
          accessibilityLabel="Open emoji picker"
        >
          <Ionicons name="happy-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={handleInputChange}
          placeholder={editingMessage ? 'Edit message...' : `Message ${recipientName}`}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={4000}
          autoCorrect={!incognitoKeyboard}
          autoComplete={incognitoKeyboard ? 'off' : undefined}
          spellCheck={!incognitoKeyboard}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
          accessibilityLabel={editingMessage ? 'Edit message' : 'Message input'}
          accessibilityHint="Type your message"
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel={editingMessage ? 'Save edit' : 'Send message'}
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
          onTranslate={handleTranslate}
          onTextReact={handleTextReact}
          forwardingDisabled={!!disappearTimer}
        />
      )}

      {/* Forward modal */}
      {forwardContent !== null && (
        <ForwardModal
          visible={forwardContent !== null}
          onClose={() => setForwardContent(null)}
          messageContent={forwardContent}
        />
      )}

      <WhoReactedSheet
        visible={!!whoReactedData}
        onClose={() => setWhoReactedData(null)}
        users={whoReactedData?.users ?? []}
        emoji={whoReactedData?.emoji ?? ''}
      />

      <TextReactionSheet
        visible={!!textReactMessage}
        onClose={() => setTextReactMessage(null)}
        onSubmit={handleTextReactSubmit}
      />

      <DisappearSettingsSheet
        visible={showDisappearSheet}
        onClose={() => setShowDisappearSheet(false)}
        channelId={channelId}
        currentTimer={disappearTimer}
        onTimerChanged={setDisappearTimer}
      />
    </KeyboardAvoidingView>
    </PatternBackground>
  );
}
