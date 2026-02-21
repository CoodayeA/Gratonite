import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import { api } from '@/lib/api';
import { useMessagesStore } from '@/stores/messages.store';
import { useAuthStore } from '@/stores/auth.store';
import { getSocket } from '@/lib/socket';
import { generateNonce } from '@/lib/utils';
import { ReplyPreview } from './ReplyPreview';
import { FileUploadButton } from './FileUploadButton';
import { AttachmentPreview, type PendingAttachment } from './AttachmentPreview';
import type { Message } from '@gratonite/types';

interface MessageComposerProps {
  channelId: string;
  placeholder?: string;
}

export function MessageComposer({ channelId, placeholder }: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingRef = useRef(0);
  const user = useAuthStore((s) => s.user);
  const addMessage = useMessagesStore((s) => s.addMessage);
  const replyingTo = useMessagesStore((s) => s.replyingTo.get(channelId) ?? null);
  const setReplyingTo = useMessagesStore((s) => s.setReplyingTo);

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

  function handleFilesSelected(files: File[]) {
    const newAttachments: PendingAttachment[] = files.map((file) => {
      const att: PendingAttachment = {
        id: crypto.randomUUID(),
        file,
      };
      if (file.type.startsWith('image/')) {
        att.preview = URL.createObjectURL(file);
      }
      return att;
    });
    setPendingFiles((prev) => [...prev, ...newAttachments]);
  }

  function handleRemoveFile(id: string) {
    setPendingFiles((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((a) => a.id !== id);
    });
  }

  async function sendMessage() {
    const trimmed = content.trim();
    if ((!trimmed && pendingFiles.length === 0) || !user) return;

    const nonce = generateNonce();
    const currentReply = replyingTo;
    const filesToUpload = [...pendingFiles];

    // Optimistic insert
    const optimistic: Message & { nonce: string; author?: { id: string; username: string; displayName: string; avatarHash: string | null } } = {
      id: nonce, // temp ID
      channelId,
      authorId: user.id,
      content: trimmed,
      type: 0,
      createdAt: new Date().toISOString(),
      editedTimestamp: null,
      pinned: false,
      nonce,
      author: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarHash: user.avatarHash ?? null,
      },
    } as any;

    addMessage(optimistic);
    setContent('');
    setPendingFiles([]);
    if (currentReply) setReplyingTo(channelId, null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      // Upload files first if any
      let attachmentIds: string[] | undefined;
      if (filesToUpload.length > 0) {
        const uploads = await Promise.all(
          filesToUpload.map((att) => api.files.upload(att.file, 'attachment')),
        );
        attachmentIds = uploads.map((u) => u.id);
        // Clean up object URLs
        filesToUpload.forEach((att) => {
          if (att.preview) URL.revokeObjectURL(att.preview);
        });
      }

      const body: { content: string; nonce: string; messageReference?: { messageId: string }; attachmentIds?: string[] } = {
        content: trimmed,
        nonce,
      };
      if (currentReply) {
        body.messageReference = { messageId: currentReply.id };
      }
      if (attachmentIds && attachmentIds.length > 0) {
        body.attachmentIds = attachmentIds;
      }

      await api.messages.send(channelId, body);
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
      {replyingTo && (
        <ReplyPreview
          message={replyingTo}
          onCancel={() => setReplyingTo(channelId, null)}
        />
      )}
      <AttachmentPreview attachments={pendingFiles} onRemove={handleRemoveFile} />
      <div className="message-composer-row">
        <FileUploadButton onFilesSelected={handleFilesSelected} />
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
    </div>
  );
}
