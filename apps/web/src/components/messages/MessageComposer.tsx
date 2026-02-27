import { useState, useRef, useCallback, useMemo, type KeyboardEvent, type ChangeEvent, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useMessagesStore } from '@/stores/messages.store';
import { useAuthStore } from '@/stores/auth.store';
import { getSocket } from '@/lib/socket';
import { generateNonce } from '@/lib/utils';
import { getErrorMessage } from '@/lib/utils';
import { useChannelsStore } from '@/stores/channels.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useMembersStore } from '@/stores/members.store';
import { queryClient } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { ReplyPreview } from './ReplyPreview';
import { FileUploadButton } from './FileUploadButton';
import { AttachmentPreview, type PendingAttachment } from './AttachmentPreview';
import { startInteraction, endInteractionAfterPaint } from '@/lib/perf';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import type { Message } from '@gratonite/types';

interface GuildEmoji {
  id: string;
  name: string;
  url: string;
  animated: boolean;
}

interface MessageComposerProps {
  channelId: string;
  placeholder?: string;
}

const styles = {
  composer: {
    padding: '0 16px 16px',
    flexShrink: 0,
  } as React.CSSProperties,
  row: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
  } as React.CSSProperties,
  shell: {
    width: '100%',
    display: 'grid',
    minWidth: 0,
    maxWidth: '100%',
    gap: 8,
    padding: 8,
    background:
      'linear-gradient(180deg, rgba(121, 223, 255, 0.035), transparent 35%), linear-gradient(320deg, rgba(138, 123, 255, 0.03), transparent 40%), var(--bg-input)',
    border: '1px solid color-mix(in srgb, var(--stroke) 92%, transparent)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.025), 0 8px 22px rgba(5, 8, 14, 0.14)',
    position: 'relative',
    isolation: 'isolate',
  } as React.CSSProperties,
  controls: {
    display: 'flex',
    position: 'relative',
    alignItems: 'flex-end',
    minWidth: 0,
    gap: 8,
    width: '100%',
    isolation: 'isolate',
  } as React.CSSProperties,
  input: {
    width: '100%',
    minWidth: 0,
    padding: '12px 16px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: 14,
    outline: 'none',
    resize: 'none',
    minHeight: 44,
    maxHeight: 200,
    transition: 'border-color var(--motion-fast) var(--motion-ease), background var(--motion-fast) var(--motion-ease), box-shadow var(--motion-fast) var(--motion-ease)',
    scrollbarWidth: 'thin',
  } as React.CSSProperties,
  mentionMenu: {
    position: 'absolute',
    left: 0,
    right: 72,
    bottom: 'calc(100% + 8px)',
    zIndex: 40,
    display: 'grid',
    gap: 4,
    padding: 6,
    borderRadius: 'var(--radius-lg)',
    border: '1px solid color-mix(in srgb, var(--stroke) 92%, transparent)',
    background: 'color-mix(in srgb, var(--bg-float) 96%, transparent)',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
    maxHeight: 220,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  } as React.CSSProperties,
  mentionItem: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    textAlign: 'left' as const,
    borderRadius: 10,
    padding: '8px 10px',
    display: 'grid',
    gap: 2,
    cursor: 'pointer',
  } as React.CSSProperties,
  mentionItemActive: {
    background: 'linear-gradient(90deg, rgba(121, 223, 255, 0.08), rgba(138, 123, 255, 0.05))',
  } as React.CSSProperties,
  mentionItemLabel: {
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 600,
  } as React.CSSProperties,
  mentionItemMeta: {
    color: 'var(--text-faint)',
    fontSize: 11,
  } as React.CSSProperties,
  mentionKind: {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: 4,
    padding: '1px 5px',
    borderRadius: 'var(--radius-pill)',
    border: '1px solid rgba(104, 223, 255, 0.2)',
    background: 'rgba(104, 223, 255, 0.1)',
  } as React.CSSProperties,
  emojiMenuItem: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    textAlign: 'left' as const,
    borderRadius: 10,
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  } as React.CSSProperties,
  emojiPreview: {
    width: 24,
    height: 24,
    objectFit: 'contain',
    borderRadius: 'var(--radius-sm)',
  } as React.CSSProperties,
  emojiBtn: {
    display: 'grid',
    placeItems: 'center',
    width: 36,
    height: 36,
    border: 'none',
    background: 'transparent',
    borderRadius: 'var(--radius-md)',
    color: 'var(--muted)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'color 0.15s ease, background 0.15s ease',
  } as React.CSSProperties,
  emojiBtnHover: {
    color: 'var(--text)',
    background: 'rgba(121, 223, 255, 0.08)',
  } as React.CSSProperties,
  sendBtn: {
    flexShrink: 0,
    minWidth: 72,
    height: 40,
    padding: '0 12px',
    borderRadius: 10,
    borderWidth: 1, borderStyle: 'solid', borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--stroke))',
    background: 'color-mix(in srgb, var(--accent) 24%, transparent)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background var(--motion-fast) var(--motion-ease), border-color var(--motion-fast) var(--motion-ease), transform var(--motion-fast) var(--motion-ease)',
    alignSelf: 'flex-end',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  sendBtnHover: {
    background: 'color-mix(in srgb, var(--accent) 38%, transparent)',
    borderColor: 'color-mix(in srgb, var(--accent) 55%, var(--stroke))',
    transform: 'translateY(-1px)',
  } as React.CSSProperties,
  sendBtnDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
    transform: 'none',
  } as React.CSSProperties,
  error: {
    color: 'var(--danger)',
    fontSize: 12,
    padding: '4px 0',
  } as React.CSSProperties,
};

export function MessageComposer({ channelId, placeholder }: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [sendError, setSendError] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiAutocompleteOpen, setEmojiAutocompleteOpen] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState('');
  const [emojiRange, setEmojiRange] = useState<{ start: number; end: number } | null>(null);
  const [emojiIndex, setEmojiIndex] = useState(0);
  const [emojiBtnHovered, setEmojiBtnHovered] = useState(false);
  const [sendBtnHovered, setSendBtnHovered] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const lastTypingRef = useRef(0);
  const isComposingRef = useRef(false);
  const user = useAuthStore((s) => s.user);
  const channel = useChannelsStore((s) => s.channels.get(channelId));
  const currentGuildId = useGuildsStore((s) => s.currentGuildId);
  const guildId = channel?.guildId ?? currentGuildId ?? null;
  const guildMembers = useMembersStore((s) => (guildId ? s.membersByGuild.get(guildId) : undefined));
  const addMessage = useMessagesStore((s) => s.addMessage);
  const replyingTo = useMessagesStore((s) => s.replyingTo.get(channelId) ?? null);
  const setReplyingTo = useMessagesStore((s) => s.setReplyingTo);
  const canSend = content.trim().length > 0 || pendingFiles.length > 0;
  const { data: guildRoles = [] } = useQuery({
    queryKey: ['guilds', guildId, 'roles'],
    queryFn: () => (guildId ? api.guilds.getRoles(guildId) : Promise.resolve([])),
    enabled: Boolean(guildId),
    staleTime: 60_000,
  });

  const { data: guildEmojis = [] } = useQuery<GuildEmoji[]>({
    queryKey: ['guild-emojis', guildId],
    queryFn: () => (guildId ? api.guilds.getEmojis(guildId) : Promise.resolve([])),
    enabled: Boolean(guildId),
    staleTime: 300_000,
  });

  const filteredEmojiCandidates = useMemo(() => {
    if (!emojiAutocompleteOpen) return [];
    const q = emojiQuery.trim().toLowerCase();
    const filtered = q
      ? guildEmojis.filter((emoji) => emoji.name.toLowerCase().includes(q))
      : guildEmojis;
    return filtered.slice(0, 8);
  }, [emojiAutocompleteOpen, emojiQuery, guildEmojis]);

  const baseMentionCandidates = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{
      id: string;
      label: string;
      secondary?: string;
      token: string;
      insertText: string;
      kind: 'user' | 'group';
    }> = [];

    if (guildMembers) {
      for (const [id, member] of guildMembers.entries()) {
        if (user && id === user.id) continue;
        const label = member.profile?.nickname ?? member.nickname ?? member.user?.displayName ?? member.user?.username ?? `User ${id}`;
        const secondary = member.user?.username ? `@${member.user.username}` : undefined;
        if (seen.has(id)) continue;
        seen.add(id);
        const handle = member.user?.username ?? label;
        out.push({ id, label, secondary, token: `<@${id}>`, insertText: `@${handle}`, kind: 'user' });
      }
    } else if (channel?.type === 'DM') {
      const dmChannels = (queryClient.getQueryData(['relationships', 'dms']) as Array<{ id: string; otherUserId?: string | null }> | undefined) ?? [];
      const dm = dmChannels.find((row) => row.id === channelId);
      const otherUserId = dm?.otherUserId ?? null;
      if (otherUserId && (!user || otherUserId !== user.id)) {
        const allUserSummaryCache = queryClient
          .getQueriesData<Array<{ id: string; username: string; displayName: string }>>({ queryKey: ['users', 'summaries'] })
          .flatMap(([, data]) => data ?? []);
        const summary = allUserSummaryCache.find((u) => u.id === otherUserId);
        out.push({
          id: otherUserId,
          label: summary?.displayName ?? summary?.username ?? `User ${otherUserId}`,
          secondary: summary?.username ? `@${summary.username}` : undefined,
          token: `<@${otherUserId}>`,
          insertText: `@${summary?.username ?? summary?.displayName ?? `user-${otherUserId.slice(-4)}`}`,
          kind: 'user',
        });
      }
    }

    if (guildId) {
      for (const role of guildRoles as Array<{ id: string; name: string; mentionable?: boolean; managed?: boolean }>) {
        if (role.managed) continue;
        if (role.mentionable === false) continue;
        const roleId = String(role.id);
        const key = `role:${roleId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          id: roleId,
          label: role.name,
          secondary: 'Group',
          token: `<@&${roleId}>`,
          insertText: `@${role.name}`,
          kind: 'group',
        });
      }
    }

    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [guildMembers, channel?.type, channelId, user, guildId, guildRoles]);

  const filteredMentionCandidates = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.trim().toLowerCase();
    const filtered = q
      ? baseMentionCandidates.filter((candidate) =>
        candidate.label.toLowerCase().includes(q)
        || candidate.secondary?.toLowerCase().includes(q),
      )
      : baseMentionCandidates;
    return filtered.slice(0, 8);
  }, [mentionOpen, mentionQuery, baseMentionCandidates]);

  const mentionTokenMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const candidate of baseMentionCandidates) {
      map.set(candidate.insertText.toLowerCase(), candidate.token);
      map.set(`@${candidate.label}`.toLowerCase(), candidate.token);
      if (candidate.secondary?.startsWith('@')) {
        map.set(candidate.secondary.toLowerCase(), candidate.token);
      }
    }
    return map;
  }, [baseMentionCandidates]);

  const serializeMentionsForSend = useCallback((inputText: string) => {
    if (!inputText.includes('@') || mentionTokenMap.size === 0) return inputText;
    const keys = Array.from(mentionTokenMap.keys()).sort((a, b) => b.length - a.length);
    let out = '';
    let i = 0;
    while (i < inputText.length) {
      let matched = false;
      for (const key of keys) {
        if (!inputText.slice(i).toLowerCase().startsWith(key)) continue;
        const prev = i > 0 ? (inputText[i - 1] ?? '') : '';
        const next = inputText[i + key.length] ?? '';
        const prevOk = i === 0 || /\s|[([{'"`]/.test(prev);
        const nextOk = !next || /\s|[)\]}'"`,.!?:;/-]/.test(next);
        if (!prevOk || !nextOk) continue;
        out += mentionTokenMap.get(key) ?? inputText.slice(i, i + key.length);
        i += key.length;
        matched = true;
        break;
      }
      if (!matched) {
        out += inputText[i] ?? '';
        i += 1;
      }
    }
    return out;
  }, [mentionTokenMap]);

  const closeMentionMenu = useCallback(() => {
    setMentionOpen(false);
    setMentionQuery('');
    setMentionRange(null);
    setMentionIndex(0);
  }, []);

  const closeEmojiMenu = useCallback(() => {
    setEmojiAutocompleteOpen(false);
    setEmojiQuery('');
    setEmojiRange(null);
    setEmojiIndex(0);
  }, []);

  const syncMentionState = useCallback((nextValue: string, selectionStart: number | null) => {
    const caret = selectionStart ?? nextValue.length;
    const beforeCaret = nextValue.slice(0, caret);
    const match = beforeCaret.match(/(?:^|\s)@([a-zA-Z0-9_.-]{0,32})$/);
    if (!match) {
      closeMentionMenu();
      return;
    }
    const raw = match[1] ?? '';
    const atPos = beforeCaret.lastIndexOf('@');
    if (atPos < 0) return;
    setMentionOpen(true);
    setMentionQuery(raw);
    setMentionRange({ start: atPos, end: caret });
    setMentionIndex(0);
  }, [closeMentionMenu]);

  const syncEmojiState = useCallback((nextValue: string, selectionStart: number | null) => {
    const caret = selectionStart ?? nextValue.length;
    const beforeCaret = nextValue.slice(0, caret);
    const match = beforeCaret.match(/(?:^|\s):([a-zA-Z0-9_]{0,32})$/);
    if (!match) {
      closeEmojiMenu();
      return;
    }
    const raw = match[1] ?? '';
    const colonPos = beforeCaret.lastIndexOf(':');
    if (colonPos < 0) return;
    setEmojiAutocompleteOpen(true);
    setEmojiQuery(raw);
    setEmojiRange({ start: colonPos, end: caret });
    setEmojiIndex(0);
  }, [closeEmojiMenu]);

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
    const nextValue = e.target.value;
    const endsWithLineBreak = nextValue.endsWith('\n');
    const normalizedValue = endsWithLineBreak ? nextValue.replace(/\r?\n$/, '') : nextValue;

    setContent(normalizedValue);
    syncMentionState(normalizedValue, e.target.selectionStart);
    syncEmojiState(normalizedValue, e.target.selectionStart);
    adjustHeight();
    if (normalizedValue.trim()) {
      emitTyping();
    }

    // iOS virtual keyboards can insert a line break instead of firing a reliable Enter key event.
    if (endsWithLineBreak && !isComposingRef.current) {
      sendMessage(normalizedValue);
    }
  }

  function insertMention(insertText: string, label: string) {
    const ta = textareaRef.current;
    const range = mentionRange;
    if (!ta || !range) return;
    const next = `${content.slice(0, range.start)}${insertText} ${content.slice(range.end)}`;
    const nextCaret = range.start + insertText.length + 1;
    setContent(next);
    closeMentionMenu();
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(nextCaret, nextCaret);
      adjustHeight();
    });
    if (label) {
      emitTyping();
    }
  }

  function insertEmoji(emoji: GuildEmoji) {
    const ta = textareaRef.current;
    const range = emojiRange;
    if (!ta || !range) return;
    const shortcode = `:${emoji.name}:`;
    const next = `${content.slice(0, range.start)}${shortcode} ${content.slice(range.end)}`;
    const nextCaret = range.start + shortcode.length + 1;
    setContent(next);
    closeEmojiMenu();
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(nextCaret, nextCaret);
      adjustHeight();
    });
  }

  function handleFilesSelected(files: File[]) {
    const newAttachments: PendingAttachment[] = files.map((file) => {
      const att: PendingAttachment = {
        id: generateNonce(),
        file,
      };
      if (file.type.startsWith('image/')) {
        att.preview = URL.createObjectURL(file);
      }
      return att;
    });
    setPendingFiles((prev) => [...prev, ...newAttachments]);
    closeMentionMenu();
  }

  function handleRemoveFile(id: string) {
    setPendingFiles((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((a) => a.id !== id);
    });
  }

  function handleClearFiles() {
    setPendingFiles((prev) => {
      prev.forEach((att) => {
        if (att.preview) URL.revokeObjectURL(att.preview);
      });
      return [];
    });
  }

  function handleEmojiSelect(emoji: string) {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newContent = content.slice(0, start) + emoji + content.slice(end);
      setContent(newContent);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + emoji.length;
        ta.focus();
      });
    } else {
      setContent((prev) => prev + emoji);
    }
    setEmojiOpen(false);
  }

  async function sendMessage(contentOverride?: string) {
    const trimmed = (contentOverride ?? content).trim();
    if (!trimmed && pendingFiles.length === 0) return;
    setSendError('');
    closeMentionMenu();

    const nonce = generateNonce();
    const currentReply = replyingTo;
    const filesToUpload = [...pendingFiles];
    const sendInteraction = startInteraction('message_send_local_echo', {
      channelId,
      hasAttachments: filesToUpload.length > 0 ? '1' : '0',
    });

    // Optimistic insert
    if (user) {
      const optimistic: Message & { nonce: string; author?: { id: string; username: string; displayName: string; avatarHash: string | null } } = {
        id: nonce,
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
    }
    endInteractionAfterPaint(sendInteraction, {
      channelId,
      optimisticBytes: trimmed.length,
      attachmentCount: filesToUpload.length,
    });
    setContent('');
    setPendingFiles([]);
    if (currentReply) setReplyingTo(channelId, null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      let attachmentIds: string[] | undefined;
      if (filesToUpload.length > 0) {
        const uploadInteraction = startInteraction('attachment_upload', {
          channelId,
          attachmentCount: String(filesToUpload.length),
        });
        const uploads = await Promise.all(
          filesToUpload.map((att) => api.files.upload(att.file, 'upload')),
        );
        endInteractionAfterPaint(uploadInteraction, {
          channelId,
          attachmentCount: filesToUpload.length,
        });
        attachmentIds = uploads.map((u) => u.id);
        filesToUpload.forEach((att) => {
          if (att.preview) URL.revokeObjectURL(att.preview);
        });
      }

      const serializedContent = serializeMentionsForSend(trimmed);
      const body: { content: string; nonce: string; messageReference?: { messageId: string }; attachmentIds?: string[] } = {
        content: serializedContent,
        nonce,
      };
      if (currentReply) {
        body.messageReference = { messageId: currentReply.id };
      }
      if (attachmentIds && attachmentIds.length > 0) {
        body.attachmentIds = attachmentIds;
      }

      const created = await api.messages.send(channelId, body);
      addMessage(created as any);
    } catch (err) {
      console.error('[Composer] Failed to send message:', err);
      setSendError(getErrorMessage(err));
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionOpen && filteredMentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredMentionCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + filteredMentionCandidates.length) % filteredMentionCandidates.length);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredMentionCandidates[mentionIndex] ?? filteredMentionCandidates[0];
        if (selected) insertMention(selected.insertText, selected.label);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMentionMenu();
        return;
      }
    }
    if (emojiAutocompleteOpen && filteredEmojiCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setEmojiIndex((prev) => (prev + 1) % filteredEmojiCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setEmojiIndex((prev) => (prev - 1 + filteredEmojiCandidates.length) % filteredEmojiCandidates.length);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredEmojiCandidates[emojiIndex] ?? filteredEmojiCandidates[0];
        if (selected) insertEmoji(selected);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeEmojiMenu();
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage();
  }

  const sendBtnStyle: React.CSSProperties = {
    ...styles.sendBtn,
    ...(!canSend ? styles.sendBtnDisabled : {}),
    ...(sendBtnHovered && canSend ? styles.sendBtnHover : {}),
  };

  return (
    <div style={styles.composer}>
      {replyingTo && (
        <ReplyPreview
          message={replyingTo}
          onCancel={() => setReplyingTo(channelId, null)}
        />
      )}
      <form style={styles.row} onSubmit={handleSubmit}>
        <FileUploadButton onFilesSelected={handleFilesSelected} />
        <div style={styles.shell}>
          <AttachmentPreview
            attachments={pendingFiles}
            onRemove={handleRemoveFile}
            onClearAll={pendingFiles.length > 1 ? handleClearFiles : undefined}
            compact
          />
          <div style={styles.controls}>
            <textarea
              ref={textareaRef}
              style={styles.input}
              placeholder={placeholder ?? `Message #channel`}
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={() => {
                isComposingRef.current = false;
              }}
              onClick={(e) => {
                syncMentionState((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart);
                syncEmojiState((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart);
              }}
              onKeyUp={(e) => {
                syncMentionState((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart);
                syncEmojiState((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart);
              }}
              rows={1}
              maxLength={4000}
              enterKeyHint="send"
            />
            {mentionOpen && filteredMentionCandidates.length > 0 && (
              <div style={styles.mentionMenu} role="listbox" aria-label="Mention suggestions">
                {filteredMentionCandidates.map((candidate, idx) => (
                  <button
                    key={candidate.id}
                    type="button"
                    style={{ ...styles.mentionItem, ...(idx === mentionIndex ? styles.mentionItemActive : {}) }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(candidate.insertText, candidate.label);
                    }}
                  >
                    <span style={styles.mentionItemLabel}>
                      @{candidate.label}
                      {candidate.kind === 'group' && <span style={styles.mentionKind}> group</span>}
                    </span>
                    {candidate.secondary && <span style={styles.mentionItemMeta}>{candidate.secondary}</span>}
                  </button>
                ))}
              </div>
            )}
            {emojiAutocompleteOpen && filteredEmojiCandidates.length > 0 && (
              <div style={styles.mentionMenu} role="listbox" aria-label="Emoji suggestions">
                {filteredEmojiCandidates.map((emoji, idx) => (
                  <button
                    key={emoji.id}
                    type="button"
                    style={{ ...styles.emojiMenuItem, ...(idx === emojiIndex ? styles.mentionItemActive : {}) }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertEmoji(emoji);
                    }}
                  >
                    <img src={emoji.url} alt={emoji.name} style={styles.emojiPreview} />
                    <span style={styles.mentionItemLabel}>:{emoji.name}:</span>
                    {emoji.animated && <span style={styles.mentionKind}> GIF</span>}
                  </button>
                ))}
              </div>
            )}
            <button
              ref={emojiButtonRef}
              type="button"
              style={{ ...styles.emojiBtn, ...(emojiBtnHovered ? styles.emojiBtnHover : {}) }}
              onClick={() => setEmojiOpen((prev) => !prev)}
              aria-label="Emoji"
              title="Emoji"
              onMouseEnter={() => setEmojiBtnHovered(true)}
              onMouseLeave={() => setEmojiBtnHovered(false)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </button>
            <button
              type="submit"
              style={sendBtnStyle}
              disabled={!canSend}
              aria-label="Send message"
              title="Send"
              onMouseEnter={() => setSendBtnHovered(true)}
              onMouseLeave={() => setSendBtnHovered(false)}
            >
              Send
            </button>
            {emojiOpen && (
              <EmojiPicker
                onSelect={handleEmojiSelect}
                onClose={() => setEmojiOpen(false)}
              />
            )}
          </div>
        </div>
      </form>
      {sendError && <div style={styles.error}>{sendError}</div>}
    </div>
  );
}
