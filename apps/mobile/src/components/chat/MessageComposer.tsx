import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi } from '../../lib/api';
import { colors, spacing, radius, fontSize } from '../../theme';
import type { Message } from '../../stores/messages.store';

// ── Types ────────────────────────────────────────────

interface MessageComposerProps {
  channelId: string;
  placeholder?: string;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  onTyping?: () => void;
}

// ── Helpers ──────────────────────────────────────────

function generateNonce(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ── Component ────────────────────────────────────────

export function MessageComposer({
  channelId,
  placeholder = 'Message...',
  replyingTo,
  onCancelReply,
  onTyping,
}: MessageComposerProps) {
  const [content, setContent] = useState('');
  const inputRef = useRef<TextInput>(null);
  const lastTypingEmit = useRef(0);
  const queryClient = useQueryClient();

  // ── Reply bar animation ─────────────────────────────

  const replyBarHeight = useSharedValue(0);

  useEffect(() => {
    replyBarHeight.value = withTiming(replyingTo ? 40 : 0, {
      duration: 200,
      easing: Easing.inOut(Easing.ease),
    });
  }, [replyingTo, replyBarHeight]);

  const replyBarAnimatedStyle = useAnimatedStyle(() => ({
    height: replyBarHeight.value,
    opacity: replyBarHeight.value > 0 ? 1 : 0,
    overflow: 'hidden' as const,
  }));

  // ── Send message mutation ───────────────────────────

  const sendMutation = useMutation({
    mutationFn: async (messageContent: string) => {
      const nonce = generateNonce();
      const body: { content: string; nonce: string; messageReference?: { messageId: string; channelId: string } } = {
        content: messageContent,
        nonce,
      };

      if (replyingTo) {
        body.messageReference = {
          messageId: replyingTo.id,
          channelId: replyingTo.channelId,
        };
      }

      return messagesApi.send(channelId, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
    },
  });

  // ── Send handler ────────────────────────────────────

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed || sendMutation.isPending) return;

    sendMutation.mutate(trimmed);
    setContent('');

    if (replyingTo && onCancelReply) {
      onCancelReply();
    }
  }, [content, sendMutation, replyingTo, onCancelReply, channelId]);

  // ── Typing indicator throttle ───────────────────────

  const handleChangeText = useCallback(
    (text: string) => {
      setContent(text);

      if (onTyping && text.length > 0) {
        const now = Date.now();
        if (now - lastTypingEmit.current > 3000) {
          lastTypingEmit.current = now;
          onTyping();
        }
      }
    },
    [onTyping],
  );

  // ── Focus input when replying ───────────────────────

  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  // ── Derived state ───────────────────────────────────

  const hasContent = content.trim().length > 0;
  const replyAuthorName =
    replyingTo?.author?.displayName ??
    replyingTo?.author?.username ??
    'Unknown';
  const replyPreviewText =
    replyingTo && replyingTo.content.length > 60
      ? replyingTo.content.slice(0, 60) + '...'
      : replyingTo?.content ?? '';

  return (
    <View style={styles.container}>
      {/* Reply preview bar */}
      <Animated.View style={replyBarAnimatedStyle}>
        {replyingTo && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarAccent} />
            <View style={styles.replyBarContent}>
              <Text style={styles.replyBarLabel}>
                Replying to{' '}
                <Text style={styles.replyBarAuthor}>{replyAuthorName}</Text>
              </Text>
              <Text style={styles.replyBarText} numberOfLines={1}>
                {replyPreviewText}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.replyBarClose}
              onPress={onCancelReply}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.replyBarCloseText}>X</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Input row */}
      <View style={styles.inputRow}>
        {/* Attachment button */}
        <TouchableOpacity style={styles.attachButton} activeOpacity={0.7}>
          <Text style={styles.attachIcon}>+</Text>
        </TouchableOpacity>

        {/* Text input */}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={content}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.muted}
          multiline
          maxLength={4000}
          textAlignVertical="center"
          returnKeyType="default"
          blurOnSubmit={false}
        />

        {/* Send button */}
        {hasContent && (
          <TouchableOpacity
            style={[
              styles.sendButton,
              sendMutation.isPending && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={sendMutation.isPending}
            activeOpacity={0.7}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.text.inverse} />
            ) : (
              <Text style={styles.sendIcon}>{'>'}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────

const INPUT_MAX_HEIGHT = 100; // ~4 lines

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.stroke.primary,
  },

  // ── Reply bar ─────────────────────────────
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    height: 40,
  },
  replyBarAccent: {
    width: 3,
    height: '80%',
    backgroundColor: colors.brand.primary,
    borderRadius: 1.5,
    marginRight: spacing.sm,
  },
  replyBarContent: {
    flex: 1,
  },
  replyBarLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  replyBarAuthor: {
    fontWeight: '600',
    color: colors.brand.primary,
  },
  replyBarText: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
  replyBarClose: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  replyBarCloseText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    fontWeight: '600',
  },

  // ── Input row ─────────────────────────────
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  attachIcon: {
    fontSize: fontSize.xl,
    color: colors.text.secondary,
    fontWeight: '400',
    lineHeight: fontSize.xl,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    fontSize: fontSize.md,
    color: colors.text.primary,
    maxHeight: INPUT_MAX_HEIGHT,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendIcon: {
    fontSize: fontSize.lg,
    color: '#ffffff',
    fontWeight: '700',
    marginLeft: 2,
  },
});
