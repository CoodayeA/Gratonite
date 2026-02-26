import React, { useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { channelsApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { useMessagesStore } from '../../stores/messages.store';
import { usePresenceStore } from '../../stores/presence.store';
import { useUnreadStore } from '../../stores/unread.store';
import { useChannelsStore } from '../../stores/channels.store';
import { MessageList } from '../../components/chat/MessageList';
import { MessageComposer } from '../../components/chat/MessageComposer';
import { Avatar } from '../../components/ui/Avatar';
import { PresenceDot } from '../../components/ui/PresenceDot';
import { colors, spacing, fontSize } from '../../theme';
import type { HomeStackParamList } from '../../navigation/types';
import type { Message } from '../../stores/messages.store';

// ── Types ────────────────────────────────────────────

type Nav = NativeStackNavigationProp<HomeStackParamList, 'DmChat'>;
type Route = RouteProp<HomeStackParamList, 'DmChat'>;

// ── Component ────────────────────────────────────────

export function DmChatScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { channelId } = route.params;

  const currentUserId = useAuthStore((s) => s.user?.id ?? '');
  const replyingTo = useMessagesStore(
    (s) => s.replyingTo.get(channelId) ?? null,
  );
  const setReplyingTo = useMessagesStore((s) => s.setReplyingTo);
  const markRead = useUnreadStore((s) => s.markRead);
  const getChannel = useChannelsStore((s) => s.getChannel);
  const getStatus = usePresenceStore((s) => s.getStatus);

  // ── Fetch channel info ──────────────────────────────

  const { data: channelData } = useQuery({
    queryKey: ['channel', channelId],
    queryFn: () => channelsApi.get(channelId),
    staleTime: 60_000,
  });

  // ── Derive recipient info ───────────────────────────

  const recipientInfo = useMemo(() => {
    // Try from the fetched channel data
    if (channelData) {
      // DM channels typically have a recipients array or recipientIds
      const recipients = channelData.recipients ?? channelData.recipientIds ?? [];

      if (channelData.recipients && channelData.recipients.length > 0) {
        // The API may return full recipient objects
        const recipient = channelData.recipients.find(
          (r: any) => r.id !== currentUserId,
        );
        if (recipient) {
          return {
            id: recipient.id,
            displayName: recipient.displayName ?? recipient.username,
            username: recipient.username,
            avatarHash: recipient.avatarHash ?? recipient.avatar,
          };
        }
      }

      // Fallback: recipientIds array
      if (Array.isArray(recipients)) {
        const recipientId = recipients.find((id: string) => id !== currentUserId);
        if (recipientId) {
          return {
            id: recipientId,
            displayName: channelData.name ?? 'Direct Message',
            username: undefined as string | undefined,
            avatarHash: undefined as string | undefined,
          };
        }
      }
    }

    // Fallback to channels store
    const storedChannel = getChannel(channelId);
    if (storedChannel?.recipientIds) {
      const recipientId = storedChannel.recipientIds.find(
        (id) => id !== currentUserId,
      );
      if (recipientId) {
        return {
          id: recipientId,
          displayName: storedChannel.name ?? 'Direct Message',
          username: undefined as string | undefined,
          avatarHash: undefined as string | undefined,
        };
      }
    }

    return {
      id: '',
      displayName: channelData?.name ?? 'Direct Message',
      username: undefined as string | undefined,
      avatarHash: undefined as string | undefined,
    };
  }, [channelData, currentUserId, getChannel, channelId]);

  const presenceStatus = getStatus(recipientInfo.id);

  // ── Mark as read on mount ───────────────────────────

  useEffect(() => {
    markRead(channelId);
  }, [channelId, markRead]);

  // ── Configure navigation header ────────────────────

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity
          style={styles.headerTitle}
          activeOpacity={0.7}
          onPress={() => {
            if (recipientInfo.id) {
              navigation.navigate('UserProfile', {
                userId: recipientInfo.id,
              });
            }
          }}
        >
          <Avatar
            size={28}
            userId={recipientInfo.id || undefined}
            avatarHash={recipientInfo.avatarHash}
            displayName={recipientInfo.displayName}
            username={recipientInfo.username}
          />
          <Text style={styles.headerName} numberOfLines={1}>
            {recipientInfo.displayName}
          </Text>
          {recipientInfo.id ? (
            <PresenceDot status={presenceStatus} size={8} />
          ) : null}
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionButton} activeOpacity={0.6}>
            <Text style={styles.headerActionIcon}>{'T'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionButton} activeOpacity={0.6}>
            <Text style={styles.headerActionIcon}>{'V'}</Text>
          </TouchableOpacity>
        </View>
      ),
      headerTransparent: false,
      headerStyle: { backgroundColor: colors.bg.secondary },
      headerShadowVisible: false,
    });
  }, [navigation, recipientInfo, presenceStatus]);

  // ── Reply handlers ──────────────────────────────────

  const handleCancelReply = useCallback(() => {
    setReplyingTo(channelId, null);
  }, [channelId, setReplyingTo]);

  const handlePressAvatar = useCallback(
    (userId: string) => {
      navigation.navigate('UserProfile', { userId });
    },
    [navigation],
  );

  // ── Typing handler (placeholder) ────────────────────

  const handleTyping = useCallback(() => {
    // In production, this would emit a typing event via socket:
    // emitTyping(channelId);
  }, [channelId]);

  // ── Compose placeholder ─────────────────────────────

  const composerPlaceholder = useMemo(() => {
    const name = recipientInfo.displayName ?? recipientInfo.username;
    return name ? `Message @${name}` : 'Message...';
  }, [recipientInfo]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <MessageList
        channelId={channelId}
        onPressAvatar={handlePressAvatar}
      />
      <MessageComposer
        channelId={channelId}
        placeholder={composerPlaceholder}
        replyingTo={replyingTo}
        onCancelReply={handleCancelReply}
        onTyping={handleTyping}
      />
    </KeyboardAvoidingView>
  );
}

// ── Styles ───────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },

  // ── Header ────────────────────────────────
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
    maxWidth: 180,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionIcon: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: '600',
  },
});
