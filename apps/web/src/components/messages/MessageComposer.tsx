import { useState, useRef, useCallback, useMemo, useEffect, type KeyboardEvent, type ChangeEvent, type FormEvent } from 'react';
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

interface MessageComposerProps {
  channelId: string;
  placeholder?: string;
}

export function MessageComposer({ channelId, placeholder }: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [sendError, setSendError] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
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
  // Voice message recording state (UI-only, backend recording API not yet available)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [voiceMessageBlob, setVoiceMessageBlob] = useState<Blob | null>(null);
  const [voiceMessageUrl, setVoiceMessageUrl] = useState<string | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const canSend = content.trim().length > 0 || pendingFiles.length > 0 || voiceMessageBlob !== null;
  const { data: guildRoles = [] } = useQuery({
    queryKey: ['guilds', guildId, 'roles'],
    queryFn: () => (guildId ? api.guilds.getRoles(guildId) : Promise.resolve([])),
    enabled: Boolean(guildId),
    staleTime: 60_000,
  });

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
    adjustHeight();
    if (normalizedValue.trim()) {
      emitTyping();
    }

    // iOS virtual keyboards can insert a line break instead of firing a reliable Enter key event.
    // Treat a trailing newline as an explicit send action for mobile send-key behavior.
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
      // Move cursor after emoji
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + emoji.length;
        ta.focus();
      });
    } else {
      setContent((prev) => prev + emoji);
    }
    setEmojiOpen(false);
  }

  // Voice recording handlers
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: BlobPart[] = [];

      // Set up audio analysis for waveform
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Animate waveform
      function updateWaveform() {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const normalized = Array.from(dataArray.slice(0, 24)).map((v) => v / 255);
        setWaveformData(normalized);
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      }
      updateWaveform();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setVoiceMessageBlob(blob);
        setVoiceMessageUrl(url);
        stream.getTracks().forEach((track) => track.stop());
        audioContext.close();
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        analyserRef.current = null;
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      setWaveformData([]);

      // Duration timer
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      setSendError('Could not access microphone.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  function cancelRecording() {
    stopRecording();
    if (voiceMessageUrl) URL.revokeObjectURL(voiceMessageUrl);
    setVoiceMessageBlob(null);
    setVoiceMessageUrl(null);
    setWaveformData([]);
    setRecordingDuration(0);
  }

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (voiceMessageUrl) URL.revokeObjectURL(voiceMessageUrl);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendMessage(contentOverride?: string) {
    const trimmed = (contentOverride ?? content).trim();
    if (!trimmed && pendingFiles.length === 0 && !voiceMessageBlob) return;

    // If there's a voice message, add it to pending files
    if (voiceMessageBlob) {
      const voiceFile = new File([voiceMessageBlob], 'voice-message.webm', { type: 'audio/webm' });
      pendingFiles.push({ id: generateNonce(), file: voiceFile });
      setVoiceMessageBlob(null);
      if (voiceMessageUrl) URL.revokeObjectURL(voiceMessageUrl);
      setVoiceMessageUrl(null);
      setWaveformData([]);
      setRecordingDuration(0);
    }
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
      // Upload files first if any
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
        // Clean up object URLs
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
      // If send fails, the optimistic message stays but could be marked failed
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
    if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage();
  }

  return (
    <div className="message-composer">
      {replyingTo && (
        <ReplyPreview
          message={replyingTo}
          onCancel={() => setReplyingTo(channelId, null)}
        />
      )}
      <form className="message-composer-row" onSubmit={handleSubmit}>
        <FileUploadButton onFilesSelected={handleFilesSelected} />
        <div className="message-composer-shell">
          <AttachmentPreview
            attachments={pendingFiles}
            onRemove={handleRemoveFile}
            onClearAll={pendingFiles.length > 1 ? handleClearFiles : undefined}
            compact
          />
          {/* Voice message recording/preview */}
          {(isRecording || voiceMessageUrl) && (
            <div className="voice-message-preview">
              {isRecording && (
                <div className="voice-recording-indicator">
                  <span className="voice-recording-dot" />
                  <span className="voice-recording-time">{formatDuration(recordingDuration)}</span>
                  <div className="voice-waveform">
                    {waveformData.map((value, i) => (
                      <div
                        key={i}
                        className="voice-waveform-bar"
                        style={{ height: `${Math.max(4, value * 32)}px` }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="voice-cancel-btn"
                    onClick={cancelRecording}
                    title="Cancel recording"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {!isRecording && voiceMessageUrl && (
                <div className="voice-playback-preview">
                  <audio src={voiceMessageUrl} controls className="voice-audio-player" />
                  <span className="voice-recording-time">{formatDuration(recordingDuration)}</span>
                  <button
                    type="button"
                    className="voice-cancel-btn"
                    onClick={cancelRecording}
                    title="Discard voice message"
                  >
                    Discard
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="message-composer-controls">
            <textarea
              ref={textareaRef}
              className="message-composer-input"
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
              onClick={(e) => syncMentionState((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart)}
              onKeyUp={(e) => syncMentionState((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart)}
              rows={1}
              maxLength={4000}
              enterKeyHint="send"
            />
            {mentionOpen && filteredMentionCandidates.length > 0 && (
              <div className="composer-mention-menu" role="listbox" aria-label="Mention suggestions">
                {filteredMentionCandidates.map((candidate, idx) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className={`composer-mention-item ${idx === mentionIndex ? 'is-active' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(candidate.insertText, candidate.label);
                    }}
                  >
                    <span className="composer-mention-item-label">
                      @{candidate.label}
                      {candidate.kind === 'group' && <span className="composer-mention-kind"> group</span>}
                    </span>
                    {candidate.secondary && <span className="composer-mention-item-meta">{candidate.secondary}</span>}
                  </button>
                ))}
              </div>
            )}
            {/* Voice message record button */}
            <button
              type="button"
              className={`message-emoji-btn ${isRecording ? 'voice-recording-active' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              aria-label={isRecording ? 'Stop recording' : 'Record voice message'}
              title={isRecording ? 'Stop recording' : 'Record voice message'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
            <button
              ref={emojiButtonRef}
              type="button"
              className="message-emoji-btn"
              onClick={() => setEmojiOpen((prev) => !prev)}
              aria-label="Emoji"
              title="Emoji"
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
              className="message-send-btn"
              disabled={!canSend}
              aria-label="Send message"
              title="Send"
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
      {sendError && <div className="home-error">{sendError}</div>}
    </div>
  );
}
