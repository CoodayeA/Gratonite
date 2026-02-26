import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { PortalsStackParamList } from '../../navigation/types';
import { messagesApi } from '../../lib/api';
import { Avatar } from '../../components/ui/Avatar';
import { colors, fontSize, spacing, radius } from '../../theme';

type Route = RouteProp<PortalsStackParamList, 'PinnedMessages'>;

interface PinnedMessage {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  author?: {
    displayName?: string;
    username?: string;
    avatarHash?: string;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (isToday) return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;

  return `${date.toLocaleDateString([], {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  })} ${time}`;
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export function PinnedMessagesScreen() {
  const route = useRoute<Route>();
  const { channelId } = route.params;
  const queryClient = useQueryClient();

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: messages, isLoading } = useQuery<PinnedMessage[]>({
    queryKey: ['pinned-messages', channelId],
    queryFn: () => messagesApi.getPinned(channelId),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const unpinMutation = useMutation({
    mutationFn: (messageId: string) =>
      messagesApi.unpin(channelId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-messages', channelId] });
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleUnpin = useCallback(
    (msg: PinnedMessage) => {
      const authorName =
        msg.author?.displayName ?? msg.author?.username ?? 'Unknown';
      const preview =
        msg.content.length > 60
          ? msg.content.slice(0, 60) + '…'
          : msg.content;

      Alert.alert(
        'Unpin Message',
        `Unpin this message from ${authorName}?\n\n"${preview}"`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unpin',
            style: 'destructive',
            onPress: () => unpinMutation.mutate(msg.id),
          },
        ],
      );
    },
    [unpinMutation],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No pinned messages yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const authorName =
            item.author?.displayName ?? item.author?.username ?? 'Unknown';

          return (
            <View style={styles.card}>
              {/* Author row */}
              <View style={styles.authorRow}>
                <Avatar
                  size={28}
                  userId={item.authorId}
                  avatarHash={item.author?.avatarHash}
                  displayName={item.author?.displayName}
                  username={item.author?.username}
                />
                <Text style={styles.authorName} numberOfLines={1}>
                  {authorName}
                </Text>
                <Text style={styles.timestamp}>
                  {formatTimestamp(item.createdAt)}
                </Text>

                <TouchableOpacity
                  style={styles.unpinBtn}
                  onPress={() => handleUnpin(item)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.unpinBtnText}>{'\u00D7'}</Text>
                </TouchableOpacity>
              </View>

              {/* Content */}
              <Text style={styles.content} numberOfLines={4}>
                {item.content}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.text.muted,
    textAlign: 'center',
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing['5xl'],
  },

  // Card
  card: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke.primary,
    padding: spacing.md,
    gap: spacing.sm,
  },

  // Author row
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  authorName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  timestamp: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },

  // Unpin button
  unpinBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent.error + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unpinBtnText: {
    color: colors.accent.error,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },

  // Content
  content: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    lineHeight: fontSize.md * 1.4,
  },
});
