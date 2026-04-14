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
  drafts as draftsApi,
  scheduledMessages as scheduledMessagesApi,
  translation as translationApi,
  textReactions as textReactionsApi,
  encryption as encryptionApi,
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
import StickyMessage from '../../components/StickyMessage';
import ReminderSheet from '../../components/ReminderSheet';
import ReplyBar from '../../components/ReplyBar';
import EditBar from '../../components/EditBar';
import PinnedMessages from '../../components/PinnedMessages';
import ForwardModal from '../../components/ForwardModal';
import EmptyState from '../../components/EmptyState';
import EmojiPicker from '../../components/EmojiPicker';
import StickerBrowser from '../../components/StickerBrowser';
import PollCreateSheet from '../../components/PollCreateSheet';
import PollCard from '../../components/PollCard';
import ScheduleMessageSheet from '../../components/ScheduleMessageSheet';
import WhoReactedSheet from '../../components/WhoReactedSheet';
import TextReactionSheet from '../../components/TextReactionSheet';
import ScrollToBottomFAB from '../../components/ScrollToBottomFAB';
import SwipeableMessage from '../../components/SwipeableMessage';
import TypingDots from '../../components/TypingDots';
import MessageSkeleton from '../../components/MessageSkeleton';
import ChatBackground from '../../components/ChatBackground';
import ChannelNotificationSheet from '../../components/ChannelNotificationSheet';
import { cacheMessages, getCachedMessages, queueSend, getPendingQueue, removePending } from '../../lib/offlineDb';
import { useIsOnline } from '../../components/OfflineBanner';
import { mediumImpact, lightImpact } from '../../lib/haptics';
import { playSound } from '../../lib/soundEngine';
import { securityStore } from '../../lib/securityStore';
import { encrypt, encryptFile, decryptFile, decrypt, getOrCreateKeyPair, decryptGroupKey, exportPublicKey } from '../../lib/crypto';
import { Buffer } from 'buffer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import type { Message, ReactionGroup, TextReactionGroup, Sticker, Poll, GuildEmoji } from '../../types';
import PatternBackground from '../../components/PatternBackground';
import PressableScale from '../../components/PressableScale';
import Reanimated, { SlideInDown } from 'react-native-reanimated';

type Props = NativeStackScreenProps<AppStackParamList, 'ChannelChat'>;

const QUICK_EMOJIS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F60E}', '\u{1F525}', '\u{1F389}'];

// -------- Date separator helpers --------

type DateSeparatorItem = {
  type: 'date-separator';
  id: string;
  date: Date;
};

type ListItem = Message | DateSeparatorItem;

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Injects date-separator items into an already-inverted (newest-first) message array. */
function injectDateSeparators(messages: Message[]): ListItem[] {
  if (messages.length === 0) return [];
  const result: ListItem[] = [];
  for (let i = 0; i < messages.length; i++) {
    result.push(messages[i]);
    const current = new Date(messages[i].createdAt);
    const next = i + 1 < messages.length ? new Date(messages[i + 1].createdAt) : null;
    if (!next || !isSameDay(current, next)) {
      result.push({ type: 'date-separator', id: `sep-${messages[i].id}`, date: current });
    }
  }
  return result;
}

function DateSeparator({ date }: { date: Date }) {
  const { colors, spacing, fontSize } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.md,
        paddingHorizontal: spacing.sm,
      }}
    >
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
      <Text
        style={{
          color: colors.textMuted,
          fontSize: fontSize.xs,
          fontWeight: '600',
          marginHorizontal: spacing.sm,
        }}
      >
        {formatDateLabel(date)}
      </Text>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
    </View>
  );
}

export default function ChannelChatScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { channelId, channelName, guildId } = route.params;
  const { user } = useAuth();
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const glass = useGlass();
  const toast = useToast();
  const isOnline = useIsOnline();
  const [channelIsEncrypted, setChannelIsEncrypted] = useState(false);
  const [channelE2EKey, setChannelE2EKey] = useState<CryptoKey | null>(null);
  const [channelKeyVersion, setChannelKeyVersion] = useState<number | null>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, string>>(new Map());
  const [attachmentUriOverrides, setAttachmentUriOverrides] = useState<Map<string, Record<string, string>>>(new Map());
  const textDecryptStartedRef = useRef<Set<string>>(new Set());
  const decryptFileInflight = useRef<Set<string>>(new Set());
  const [messageList, setMessageList] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const [showScrollFAB, setShowScrollFAB] = useState(false);
  const initialLoadDone = useRef(false);

  // Typing indicator state
  const [typingUsers, setTypingUsers] = useState<Map<string, { username: string; timeout: ReturnType<typeof setTimeout> }>>(new Map());
  const typingThrottle = useRef<number>(0);
  const transientTimeouts = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

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

  // Reminder sheet
  const [reminderMessage, setReminderMessage] = useState<Message | null>(null);

  // Channel background
  const [bgMedia, setBgMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  // Drafts
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schedule message sheet
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);

  // Attach menu popup
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Who reacted sheet
  const [whoReactedData, setWhoReactedData] = useState<{ users: Array<{ id: string; username?: string }>; emoji: string } | null>(null);

  // Text reactions
  const [textReactionsMap, setTextReactionsMap] = useState<Map<string, TextReactionGroup[]>>(new Map());
  const [textReactMessage, setTextReactMessage] = useState<Message | null>(null);

  // Channel notification sheet
  const [showNotifSheet, setShowNotifSheet] = useState(false);

  // Incognito keyboard
  const [incognitoKeyboard, setIncognitoKeyboard] = useState(false);

  // Inverted data: newest first for inverted FlatList
  const invertedData = useMemo(() => [...messageList].reverse(), [messageList]);

  // Pre-compute message grouping (keyed by message id) based on message-only array
  const groupingMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (let i = 0; i < invertedData.length; i++) {
      const item = invertedData[i];
      const older = i + 1 < invertedData.length ? invertedData[i + 1] : null;
      const grouped =
        !!older &&
        older.authorId === item.authorId &&
        new Date(item.createdAt).getTime() - new Date(older.createdAt).getTime() < 5 * 60000;
      map.set(item.id, grouped);
    }
    return map;
  }, [invertedData]);

  // Data with date separators injected between day boundaries
  const invertedDataWithSeps = useMemo(() => injectDateSeparators(invertedData), [invertedData]);

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
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: -3 },
        shadowRadius: 4,
        elevation: 4,
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
      ...(neo ? {
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
      } : {}),
      ...(glass ? {
        borderWidth: 1,
        borderColor: glass.glassBorder,
      } : {}),
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
      ...(neo ? {
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
      } : {}),
      ...(glass ? {
        borderWidth: 1,
        borderColor: glass.glassBorder,
      } : {}),
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
      ...(neo ? {
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
      } : {}),
      ...(glass ? {
        borderWidth: 1,
        borderColor: glass.glassBorder,
      } : {}),
    },
    emojiPickerBtn: {
      padding: spacing.xs,
    },
    emojiPickerText: {
      fontSize: fontSize.xl,
    },
    attachMenuOverlay: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 50,
    },
    attachMenu: {
      position: 'absolute' as const,
      bottom: 56,
      left: spacing.md,
      backgroundColor: glass ? glass.glassBackground : colors.bgElevated,
      borderRadius: neo ? 0 : borderRadius.lg,
      paddingVertical: spacing.sm,
      minWidth: 200,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 51,
      ...(neo ? {
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
      } : {}),
      ...(glass ? {
        borderWidth: 1,
        borderColor: glass.glassBorder,
      } : {}),
    },
    attachMenuItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    attachMenuLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500' as const,
    },
  }), [colors, spacing, fontSize, borderRadius, neo, glass]);

  // Set header with pin and member list buttons
  useEffect(() => {
    navigation?.setOptions?.({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity onPress={() => setShowNotifSheet(true)} style={{ padding: spacing.sm }} accessibilityLabel="Channel notifications">
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowPinned(true)} style={{ padding: spacing.sm }} accessibilityLabel="Pinned messages">
            <Ionicons name="pin-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            const guildId = route.params?.guildId;
            if (guildId) navigation.navigate('GuildMemberList', { guildId, guildName: channelName });
          }} style={{ padding: spacing.sm }} accessibilityLabel="Member list">
            <Ionicons name="people-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, route.params?.guildId, colors, spacing]);

  const fetchMessages = useCallback(async () => {
    // Show cached data immediately while fetching from network
    getCachedMessages(channelId).then(cached => {
      if (cached.length > 0 && !initialLoadDone.current) {
        setMessageList(cached);
        setHasMoreHistory(cached.length >= 50);
        setLoading(false);
      }
    }).catch(() => {});
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

  // Fetch custom emojis for this guild
  useEffect(() => {
    if (guildId) {
      guildEmojisApi.list(guildId).then(setCustomEmojis).catch(() => {});
    }
  }, [guildId]);

  // Load incognito keyboard pref and re-read on screen focus
  useEffect(() => {
    securityStore.getIncognitoKeyboard().then(setIncognitoKeyboard).catch(() => {});
    const unsubscribe = navigation.addListener('focus', () => {
      securityStore.getIncognitoKeyboard().then(setIncognitoKeyboard).catch(() => {});
    });
    return unsubscribe;
  }, [navigation]);

  // Channel background + guild channel E2E key (when isEncrypted)
  useEffect(() => {
    if (!user?.id) return;
    channelsApi.get(channelId).then(async (ch) => {
      if (ch.backgroundUrl) {
        setBgMedia({ url: ch.backgroundUrl, type: ch.backgroundType || 'image' });
      }
      const enc = !!(ch as { isEncrypted?: boolean }).isEncrypted;
      setChannelIsEncrypted(enc);
      if (enc && guildId) {
        try {
          let kp = await getOrCreateKeyPair(
            user.id,
            async (pub) => {
              await encryptionApi.uploadPublicKey(pub);
            },
            { createIfMissing: false },
          );
          const remoteKey = await encryptionApi.getPublicKey(user.id);
          if (kp) {
            const localPublicKeyJwk = await exportPublicKey(kp.publicKey);
            if (remoteKey?.publicKeyJwk && remoteKey.publicKeyJwk !== localPublicKeyJwk) {
              setChannelE2EKey(null);
              setChannelKeyVersion(null);
              return;
            }
          }
          if (!kp && !remoteKey?.publicKeyJwk) {
            kp = await getOrCreateKeyPair(user.id, async (pub) => {
              await encryptionApi.uploadPublicKey(pub);
            });
          }
          if (!kp) {
            setChannelE2EKey(null);
            setChannelKeyVersion(null);
            return;
          }
          const encKeyData = await channelsApi.getEncryptionKeys(guildId, channelId);
          setChannelKeyVersion(encKeyData.version ?? null);
          const myWrapped = encKeyData.keyData[user.id];
          if (myWrapped) {
            const gk = await decryptGroupKey(myWrapped, kp.privateKey);
            setChannelE2EKey(gk);
          } else {
            setChannelE2EKey(null);
          }
        } catch {
          setChannelE2EKey(null);
          setChannelKeyVersion(null);
        }
      } else {
        setChannelE2EKey(null);
        setChannelKeyVersion(null);
      }
    }).catch(() => {});
  }, [channelId, guildId, user?.id]);

  useEffect(() => {
    textDecryptStartedRef.current.clear();
    decryptFileInflight.current.clear();
  }, [channelId, channelE2EKey]);

  // Decrypt encrypted guild messages (text + E2E attachment v2)
  useEffect(() => {
    if (!channelE2EKey) return;
    const controller = new AbortController();

    for (const msg of messageList) {
      if (!msg.isEncrypted || !msg.encryptedContent) continue;
      if (textDecryptStartedRef.current.has(msg.id)) continue;
      textDecryptStartedRef.current.add(msg.id);

      void (async () => {
        try {
          const plain = await decrypt(channelE2EKey, msg.encryptedContent!);
          let displayText = plain;
          try {
            const parsed = JSON.parse(plain) as { _e2e?: number; text?: string | null; files?: Array<{ id: string; iv: string; ef: string; mt: string }> };
            if (parsed && parsed._e2e === 2) {
              displayText = parsed.text?.trim() === '' ? '' : (parsed.text ?? '');
              if (Array.isArray(parsed.files) && parsed.files.length > 0 && msg.attachments) {
                for (const fileMeta of parsed.files) {
                  const att = msg.attachments.find((a) => a.id === fileMeta.id);
                  const inflightKey = `${msg.id}:${fileMeta.id}`;
                  if (!att || decryptFileInflight.current.has(inflightKey)) continue;
                  decryptFileInflight.current.add(inflightKey);
                  fetch(att.url, { signal: controller.signal })
                    .then((r) => r.arrayBuffer())
                    .then(async (buf) => {
                      const { buffer } = await decryptFile(channelE2EKey, buf, fileMeta.iv, fileMeta.ef);
                      const mime = fileMeta.mt || 'application/octet-stream';
                      const b64 = Buffer.from(buffer).toString('base64');
                      const dataUri = `data:${mime};base64,${b64}`;
                      setAttachmentUriOverrides((prev) => {
                        const next = new Map(prev);
                        const row = { ...(next.get(msg.id) ?? {}) };
                        row[fileMeta.id] = dataUri;
                        next.set(msg.id, row);
                        return next;
                      });
                    })
                    .catch(() => {})
                    .finally(() => {
                      decryptFileInflight.current.delete(inflightKey);
                    });
                }
              }
            }
          } catch {
            /* plain text */
          }
          setDecryptedMessages((prev) => {
            if (prev.has(msg.id)) return prev;
            return new Map(prev).set(msg.id, displayText);
          });
        } catch {
          setDecryptedMessages((prev) => {
            if (prev.has(msg.id)) return prev;
            return new Map(prev).set(msg.id, '[Decryption failed]');
          });
        }
      })();
    }

    return () => controller.abort();
  }, [channelE2EKey, messageList]);

  // Socket: new messages
  useEffect(() => {
    const unsub = onMessageCreate((data: any) => {
      if (data.channelId === channelId) {
        if (!data.id || !data.authorId) return;
        const msg: Message = {
          id: data.id,
          channelId: data.channelId,
          authorId: data.authorId,
          content: data.content ?? '',
          type: data.type ?? 0,
          createdAt: data.createdAt,
          editedAt: null,
          author: data.author,
          attachments: Array.isArray(data.attachments) ? data.attachments : undefined,
          replyToId: data.replyToId,
          replyTo: data.replyTo,
          nonce: data.nonce,
          isEncrypted: !!data.isEncrypted,
          encryptedContent: data.encryptedContent ?? null,
          isFederated: data.isFederated === true,
        };
        setMessageList((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          const withoutOptimistic = data.nonce
            ? prev.filter((m) => !(m.id.startsWith('temp-') && (m as any).nonce === data.nonce))
            : prev;
          return [...withoutOptimistic, msg];
        });
        if (data.authorId !== user?.id) {
          playSound('messageReceive');
        }
      }
    });
    return unsub;
  }, [channelId, user?.id]);

  // Socket: message updates (edits)
  useEffect(() => {
    const unsub = onMessageUpdate((data: any) => {
      if (data.channelId === channelId) {
        if (!data.id) return;
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
        if (!data.id) return;
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
        next.set(data.userId, { username: data.username || data.displayName || data.userId, timeout });
        return next;
      });
    });
    return unsub;
  }, [channelId, user?.id]);

  // Clear typing timeouts and draft timer on channel switch or unmount
  useEffect(() => {
    return () => {
      if (draftSaveTimer.current) {
        clearTimeout(draftSaveTimer.current);
        draftSaveTimer.current = null;
      }
      transientTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      transientTimeouts.current.clear();
      setTypingUsers((prev) => {
        prev.forEach((entry) => clearTimeout(entry.timeout));
        return new Map();
      });
    };
  }, [channelId]);

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

  // Flush pending offline queue when reconnecting (all channels)
  useEffect(() => {
    if (!isOnline) return;
    setTypingUsers(new Map());
    (async () => {
      const pending = await getPendingQueue();
      for (const item of pending) {
        try {
          if (item.isEncrypted && item.encryptedContent) {
            await messagesApi.send(item.channelId, {
              content: '',
              isEncrypted: true,
              encryptedContent: item.encryptedContent,
            });
          } else {
            await messagesApi.send(item.channelId, item.content);
          }
          await removePending(item.id);
        } catch (err: any) {
          if (err?.status === 404) {
            await removePending(item.id);
            continue;
          }
          break;
        }
      }
    })();
  }, [isOnline]);

  // --- Actions ---

  const scrollToMessage = useCallback((messageId: string) => {
    const targetIndex = invertedDataWithSeps.findIndex((m) => m.id === messageId);
    if (targetIndex >= 0) {
      flatListRef.current?.scrollToIndex({ index: targetIndex, animated: true, viewPosition: 0.5 });
    } else {
      toast.info('Original message is not loaded yet');
    }
  }, [invertedDataWithSeps, toast]);

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
              ? { ...m, content: text, editedAt: new Date().toISOString(), replyTo: m.replyTo, replyToId: m.replyToId, attachments: m.attachments }
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

    if (channelIsEncrypted && !channelE2EKey) {
      toast.error('Restore your encryption key before sending in this channel');
      return;
    }

    if (!isOnline) {
      if (channelIsEncrypted && channelE2EKey) {
        const encryptedContent = await encrypt(channelE2EKey, text);
        await queueSend(channelId, text, { isEncrypted: true, encryptedContent });
      } else {
        await queueSend(channelId, text);
      }
      setInputText('');
      toast.info('Message queued - will send when online');
      return;
    }

    setSending(true);
    setInputText('');
    const nonce = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticId = nonce;
    const optimisticMessage: Message = {
      id: optimisticId,
      channelId,
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
      replyToId: replyingTo?.id ?? null,
      replyTo: replyingTo?.replyTo ? replyingTo.replyTo : replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content,
        authorId: replyingTo.authorId,
        author: replyingTo.author ? {
          id: replyingTo.author.id,
          username: replyingTo.author.username,
          displayName: replyingTo.author.displayName,
        } : undefined,
      } : null,
      nonce,
    } as any;
    setMessageList((prev) => [...prev, optimisticMessage]);
    try {
      const messagePayload = channelIsEncrypted && channelE2EKey
        ? {
            content: '',
            nonce,
            isEncrypted: true,
            encryptedContent: await encrypt(channelE2EKey, text),
            ...(replyingTo ? { replyToId: replyingTo.id } : {}),
            ...(channelKeyVersion != null ? { keyVersion: channelKeyVersion } : {}),
          }
        : {
            content: text,
            nonce,
            ...(replyingTo ? { replyToId: replyingTo.id } : {}),
          };
      const msg = await messagesApi.send(channelId, messagePayload);
      setMessageList((prev) => {
        if (prev.some((m) => m.id === msg.id)) {
          return prev.filter((m) => m.id !== optimisticId);
        }
        return prev.map((m) => m.id === optimisticId ? msg : m);
      });
      setReplyingTo(null);
      draftsApi.delete(channelId).catch(() => {});
      mediumImpact();
      playSound('messageSend');
    } catch {
      toast.error('Failed to send message');
      setMessageList((prev) => prev.filter((m) => m.id !== optimisticId));
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
      toast.error('Failed to load older messages');
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

    if (result.canceled || !result.assets?.length) return;
    if (!isOnline) {
      toast.info('Attach files when you are online.');
      return;
    }

    const asset = result.assets[0];
    const optimisticId = `temp-upload-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      channelId,
      authorId: user?.id || 'me',
      content: 'Uploading file...',
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
    setSending(true);
    try {
      if (channelIsEncrypted && !channelE2EKey) {
        toast.error('Restore your encryption key before uploading in this channel');
        setMessageList((prev) => prev.filter((m) => m.id !== optimisticId));
        return;
      }
      const filename = asset.fileName ?? asset.uri.split('/').pop() ?? 'upload.jpg';
      const mimeType = asset.mimeType || 'image/jpeg';
      const fileResp = await fetch(asset.uri);
      const fileBuffer = await fileResp.arrayBuffer();

      if (channelIsEncrypted && channelE2EKey) {
        const { encryptedBuffer, encryptedFilename, iv } = await encryptFile(channelE2EKey, fileBuffer, filename);
        const formData = new FormData();
        const blob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
        formData.append('file', blob as unknown as Blob, 'encrypted.bin');
        const uploadRes = await filesApi.upload(formData);
        const encryptedFileMeta = [{ id: uploadRes.id, iv, ef: encryptedFilename, mt: mimeType }];
        const plainPayload = JSON.stringify({ _e2e: 2, text: ' ', files: encryptedFileMeta });
        const encryptedContent = await encrypt(channelE2EKey, plainPayload);
        const msg = await messagesApi.send(channelId, {
          content: null,
          encryptedContent,
          isEncrypted: true,
          attachmentIds: [uploadRes.id],
          ...(channelKeyVersion != null ? { keyVersion: channelKeyVersion } : {}),
        });
        setMessageList((prev) => {
          const without = prev.filter((m) => m.id !== optimisticId);
          if (without.some((m) => m.id === msg.id)) return without;
          return [...without, msg];
        });
        setDecryptedMessages((prev) => new Map(prev).set(msg.id, ''));
        setAttachmentUriOverrides((prev) => {
          const next = new Map(prev);
          const row = { ...(next.get(msg.id) ?? {}) };
          if (uploadRes.id) row[uploadRes.id] = asset.uri;
          next.set(msg.id, row);
          return next;
        });
      } else {
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          name: filename,
          type: mimeType,
        } as any);
        const uploadRes = await filesApi.upload(formData);
        const msg = await messagesApi.send(channelId, uploadRes.url);
        setMessageList((prev) => {
          const without = prev.filter((m) => m.id !== optimisticId);
          if (without.some((m) => m.id === msg.id)) return without;
          return [...without, msg];
        });
      }
      mediumImpact();
      playSound('messageSend');
    } catch {
      setMessageList((prev) => prev.filter((m) => m.id !== optimisticId));
      toast.error('There was an error uploading your file.');
    } finally {
      setSending(false);
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
      } else {
        draftsApi.delete(channelId).catch(() => {});
      }
    }, 500);
  };

  const reactionCooldown = useRef<Set<string>>(new Set());
  const handleReactionToggle = useCallback(async (messageId: string, emoji: string) => {
    const key = `${messageId}:${emoji}`;
    if (reactionCooldown.current.has(key)) return;
    reactionCooldown.current.add(key);
    const timeout = setTimeout(() => {
      transientTimeouts.current.delete(timeout);
      reactionCooldown.current.delete(key);
    }, 1000);
    transientTimeouts.current.add(timeout);
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
  }, [channelId, messageReactions]);

  // --- Context menu handlers ---

  const handleReply = useCallback((msg: Message) => {
    setReplyingTo(msg);
    setEditingMessage(null);
  }, []);

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

  const handleReact = useCallback((msg: Message) => {
    setReactionPickerMessageId((prev) => prev === msg.id ? null : msg.id);
  }, []);

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
    setShowAttachMenu((prev) => !prev);
  };

  const handleTranslate = async (msg: Message) => {
    try {
      const result = await translationApi.translate(channelId, msg.id);
      Alert.alert('Translation', result.translatedContent);
    } catch (err: any) {
      toast.error(err.message || 'Translation failed');
    }
  };

  const handleReactionLongPress = useCallback((messageId: string, emoji: string) => {
    const rxns = messageReactions.get(messageId) ?? [];
    const reaction = rxns.find((r) => r.emoji === emoji);
    if (reaction) {
      setWhoReactedData({
        users: reaction.userIds.map((id) => ({ id })),
        emoji,
      });
    }
  }, [messageReactions]);

  const handleTextReact = (msg: Message) => {
    setTextReactMessage(msg);
  };

  const handleTextReactSubmit = async (text: string) => {
    if (!textReactMessage) return;
    try {
      await textReactionsApi.add(channelId, textReactMessage.id, text);
      // Optimistically update
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

  const handleTextReactionToggle = useCallback(async (messageId: string, text: string) => {
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
  }, [channelId, textReactionsMap]);

  const handlePollVote = useCallback(async (pollId: string, optionId: string) => {
    try {
      await pollsApi.vote(pollId, optionId);
    } catch {
      toast.error('Failed to vote');
    }
  }, [toast]);

  const handlePollRemoveVote = useCallback(async (pollId: string) => {
    try {
      await pollsApi.removeVote(pollId);
    } catch {
      toast.error('Failed to remove vote');
    }
  }, [toast]);

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

  const renderMessage = useCallback(({ item }: { item: ListItem }) => {
    // Date separators are rendered inline without interactivity
    if (item.type === 'date-separator') {
      return <DateSeparator date={item.date} />;
    }

    // Use pre-computed grouping map (avoids index dependency with mixed separator array)
    const isGrouped = groupingMap.get(item.id) ?? false;
    const isOwn = item.authorId === user?.id;
    const rxns = messageReactions.get(item.id) ?? [];
    const txtRxns = textReactionsMap.get(item.id) ?? [];
    const showPicker = reactionPickerMessageId === item.id;
    const isNew = initialLoadDone.current;

    const resolvedContent = item.isEncrypted
      ? (decryptedMessages.get(item.id) ?? (channelE2EKey ? 'Decrypting...' : '[Encrypted]'))
      : item.content;

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
            onReactionLongPress={(emoji) => handleReactionLongPress(item.id, emoji)}
            textReactions={txtRxns}
            onTextReactionToggle={(text) => handleTextReactionToggle(item.id, text)}
            isEncrypted={item.isEncrypted}
            decryptedContent={item.isEncrypted ? resolvedContent : undefined}
            attachmentUriOverrides={attachmentUriOverrides.get(item.id)}
            onReplyPress={item.replyToId ? () => scrollToMessage(item.replyToId!) : undefined}
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
  }, [groupingMap, user?.id, messageReactions, textReactionsMap, reactionPickerMessageId, customEmojis, styles, handleReply, handleReactionToggle, handleReact, handlePollVote, handlePollRemoveVote, handleReactionLongPress, handleTextReactionToggle, decryptedMessages, channelE2EKey, attachmentUriOverrides]);

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
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 24}
    >
      <View style={styles.chatWrapper}>
        {!isOnline && (
          <View style={{ backgroundColor: colors.warning, paddingVertical: 4, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: fontSize.xs, fontWeight: '600' }}>
              You are offline — messages will be queued
            </Text>
          </View>
        )}
        {bgMedia && <ChatBackground url={bgMedia.url} type={bgMedia.type} />}
        <StickyMessage channelId={channelId} />
        <FlatList
          ref={flatListRef}
          data={invertedDataWithSeps}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          inverted
          keyboardDismissMode="interactive"
          maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
          scrollEventThrottle={16}
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
                title="No messages yet"
                subtitle="Be the first to send a message!"
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
        <Reanimated.View entering={SlideInDown.springify().damping(15)} style={styles.typingBar}>
          <TypingDots />
          <Text style={styles.typingText}>
            {Array.from(typingUsers.values()).map((t) => t.username).join(', ')}{' '}
            {typingUsers.size === 1 ? 'is' : 'are'} typing
          </Text>
        </Reanimated.View>
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

      {/* Attach popup menu */}
      {showAttachMenu && (
        <>
          <TouchableOpacity
            style={styles.attachMenuOverlay}
            activeOpacity={1}
            onPress={() => setShowAttachMenu(false)}
          />
          <View style={styles.attachMenu}>
            <TouchableOpacity style={styles.attachMenuItem} onPress={() => { setShowAttachMenu(false); handlePickImage(); }}>
              <Ionicons name="image-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.attachMenuLabel}>Image / Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachMenuItem} onPress={() => { setShowAttachMenu(false); setShowStickerBrowser(true); }}>
              <Ionicons name="pricetag-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.attachMenuLabel}>Stickers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachMenuItem} onPress={() => { setShowAttachMenu(false); setShowPollCreator(true); }}>
              <Ionicons name="bar-chart-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.attachMenuLabel}>Poll</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachMenuItem} onPress={() => {
              setShowAttachMenu(false);
              if (inputText.trim()) setShowScheduleSheet(true);
              else toast.error('Type a message to schedule');
            }}>
              <Ionicons name="time-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.attachMenuLabel}>Schedule Message</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <PressableScale style={styles.attachButton} onPress={handleAttachPress} disabled={sending} accessibilityRole="button" accessibilityLabel="Attach file">
          <Ionicons name={showAttachMenu ? 'close' : 'add'} size={24} color={showAttachMenu ? colors.accentPrimary : colors.textMuted} />
        </PressableScale>
        <PressableScale
          style={styles.attachButton}
          onPress={() => setShowEmojiPicker(true)}
          accessibilityRole="button"
          accessibilityLabel="Open emoji picker"
        >
          <Ionicons name="happy-outline" size={24} color={colors.textMuted} />
        </PressableScale>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={handleInputChange}
          placeholder={editingMessage ? 'Edit message...' : `Message #${channelName}`}
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
        <PressableScale
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
        </PressableScale>
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
          onRemind={(msg) => setReminderMessage(msg)}
          onForward={handleForward}
          onTranslate={handleTranslate}
          onTextReact={handleTextReact}
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

      {reminderMessage && (
        <ReminderSheet
          visible
          onClose={() => setReminderMessage(null)}
          message={reminderMessage}
          channelId={channelId}
        />
      )}

      <ScheduleMessageSheet
        visible={showScheduleSheet}
        onClose={() => setShowScheduleSheet(false)}
        channelId={channelId}
        content={inputText}
      />

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

      <ChannelNotificationSheet
        visible={showNotifSheet}
        onClose={() => setShowNotifSheet(false)}
        channelId={channelId}
      />
    </KeyboardAvoidingView>
    </PatternBackground>
  );
}
