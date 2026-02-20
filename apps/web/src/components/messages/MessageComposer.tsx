import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import { api } from '@/lib/api';
import { useMessagesStore } from '@/stores/messages.store';
import { useAuthStore } from '@/stores/auth.store';
import { getSocket } from '@/lib/socket';
import { generateNonce } from '@/lib/utils';
import type { Message } from '@gratonite/types';

interface MessageComposerProps {
  channelId: string;
  placeholder?: string;
}

export function MessageComposer({ channelId, placeholder }: MessageComposerProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingRef = useRef(0);
  const user = useAuthStore((s) => s.user);
  const addMessage = useMessagesStore((s) => s.addMessage);

  // Auto-grow textarea
  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, []);

  // Throttled typing indicator (max once per 5s)
  const emitTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingRef.current < 5000) return;
    lastTypingRef.current = now;
    const socket = getSocket();
    if (socket) {
      socket.emit('TYPING_START', { channelId });
    }
  }, [channelId]);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    adjustHeight();
    if (e.target.value.trim()) {
      emitTyping();
    }
  }

  async function sendMessage() {
    const trimmed = content.trim();
    if (!trimmed || !user) return;

    const nonce = generateNonce();

    // Optimistic insert
    const optimistic: Message & { nonce: string } = {
      id: nonce, // temp ID
      channelId,
      authorId: user.id,
      content: trimmed,
      type: 0,
      createdAt: new Date().toISOString(),
      editedAt: null,
      pinned: false,
      nonce,
    } as Message & { nonce: string };

    addMessage(optimistic);
    setContent('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      await api.messages.send(channelId, { content: trimmed, nonce });
    } catch (err) {
      // If send fails, the optimistic message stays but could be marked failed
      console.error('[Composer] Failed to send message:', err);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="message-composer">
      <textarea
        ref={textareaRef}
        className="message-composer-input"
        placeholder={placeholder ?? `Message #channel`}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={1}
        maxLength={4000}
      />
    </div>
  );
}
