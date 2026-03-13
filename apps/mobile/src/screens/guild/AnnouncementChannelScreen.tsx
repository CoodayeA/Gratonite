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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { messages as messagesApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import RichText from '../../components/RichText';
import type { Message } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'AnnouncementChannel'>;

export default function AnnouncementChannelScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { channelId, channelName, guildId } = route.params;
  const { user } = useAuth();
  const [messageList, setMessageList] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await messagesApi.list(channelId, { limit: 50 });
      setMessageList(data.reverse());
      setLoadError(null);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load announcements';
        if (messageList.length > 0) {
          toast.error(message);
        } else {
          setLoadError(message);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [channelId, messageList.length, toast]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

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
      toast.error('Failed to send announcement');
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const renderAnnouncement = ({ item }: { item: Message }) => {
    const authorName = item.author?.displayName || item.author?.username || 'Unknown';

    return (
      <View style={styles.announcementCard}>
        <View style={styles.announcementHeader}>
          <View style={styles.megaphoneIcon}>
            <Ionicons name="megaphone" size={16} color={colors.warning} />
          </View>
          <View style={styles.announcementMeta}>
            <Text style={styles.authorName}>{authorName}</Text>
            <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.announcementContent}>
          <RichText content={item.content} />
        </View>
      </View>
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    listContent: {
      padding: spacing.md,
      paddingBottom: spacing.md,
      flexGrow: 1,
      justifyContent: 'flex-end',
      gap: spacing.md,
    },
    announcementCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      borderLeftWidth: 3,
      borderLeftColor: colors.warning,
    },
    announcementHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      gap: spacing.md,
    },
    megaphoneIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(250, 166, 26, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    announcementMeta: {
      flex: 1,
    },
    authorName: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    timeText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 1,
    },
    announcementContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
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
      backgroundColor: colors.warning,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: colors.bgElevated,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  if (loadError && messageList.length === 0) {
    return (
      <PatternBackground>
        <EmptyState
          icon="alert-circle-outline"
          title="Failed to load announcements"
          subtitle={loadError}
          actionLabel="Retry"
          onAction={fetchMessages}
        />
      </PatternBackground>
    );
  }

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
        renderItem={renderAnnouncement}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="megaphone-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No announcements yet</Text>
            <Text style={styles.emptySubtext}>Important updates will appear here</Text>
          </View>
        }
      />

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder={`Post to #${channelName}`}
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
            name="megaphone"
            size={18}
            color={inputText.trim() && !sending ? colors.white : colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </PatternBackground>
  );
}
