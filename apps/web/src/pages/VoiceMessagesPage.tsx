import { useState, useRef, CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

const S = {
  page: {
    display: 'flex',
    height: '100%',
    background: 'var(--bg)',
    color: 'var(--text)',
    overflow: 'hidden',
  },
  sidebar: {
    width: 260,
    minWidth: 260,
    background: 'var(--bg-purple-dark)',
    borderRight: '1px solid var(--stroke)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarTitle: {
    padding: '16px 16px 8px',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
  },
  sidebarSection: {
    padding: '8px 16px 4px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
  },
  channelItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 16px',
    fontSize: 14,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    margin: '0 4px',
  },
  channelItemActive: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 16px',
    fontSize: 14,
    color: 'var(--text)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    margin: '0 4px',
    background: 'var(--bg-elevated)',
    fontWeight: 600,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  topbar: {
    height: 56,
    borderBottom: '1px solid var(--stroke)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    gap: 12,
    flexShrink: 0,
  },
  topbarIcon: {
    fontSize: 18,
    color: 'var(--text-muted)',
  },
  topbarTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
  },
  messages: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  messageRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--bg-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  messageBubble: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 10,
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxWidth: 420,
  },
  messageSender: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text)',
  },
  voiceWaveform: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'var(--accent)',
    border: 'none',
    color: 'var(--text-on-gold)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: 13,
  },
  waveBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  duration: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  composer: {
    borderTop: '1px solid var(--stroke)',
    padding: '8px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  composerInput: {
    flex: 1,
    height: 40,
    background: 'var(--bg-input)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    padding: '0 14px',
    fontSize: 14,
    color: 'var(--text)',
    outline: 'none',
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'var(--accent)',
    border: 'none',
    color: 'var(--text-on-gold)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    flexShrink: 0,
  },
  micBtnRecording: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'var(--danger)',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    flexShrink: 0,
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    flexDirection: 'column',
    gap: 8,
  },
};

interface VoiceMessage {
  id: string;
  senderId: string;
  senderName: string;
  audioUrl: string;
  durationSeconds: number;
  createdAt: string;
}

function WaveformBars({ count = 24, active = false }: { count?: number; active?: boolean }) {
  const heights = Array.from({ length: count }, (_, i) =>
    Math.max(4, Math.floor(Math.sin(i * 0.7) * 14 + 16)),
  );
  return (
    <div style={S.waveBar}>
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: h,
            borderRadius: 2,
            background: active ? 'var(--accent)' : 'var(--stroke)',
            transition: 'background 0.2s',
          }}
        />
      ))}
    </div>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function VoiceMessagesPage() {
  const { guildId, channelId } = useParams<{ guildId: string; channelId: string }>();
  const user = useAuthStore((s) => s.user);
  const [isRecording, setIsRecording] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const queryClient = useQueryClient();

  const { data: channel } = useQuery({
    queryKey: ['channel', channelId],
    queryFn: () => api.channels.get(channelId!),
    enabled: !!channelId,
  });

  const { data: channels } = useQuery({
    queryKey: ['channels', guildId],
    queryFn: () => api.channels.getGuildChannels(guildId!),
    enabled: !!guildId,
  });

  // Voice messages are regular messages with an audio attachment
  const { data: messagesList } = useQuery({
    queryKey: ['messages', channelId],
    queryFn: () => api.messages.list(channelId!, { limit: 50 }),
    enabled: !!channelId,
  });

  const sendMessage = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
      const fileData = await api.files.upload(audioFile, 'voice_message');
      return api.messages.send(channelId!, {
        content: '',
        attachmentIds: [fileData.id],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', channelId] });
    },
  });

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        chunksRef.current = [];
        mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach((t) => t.stop());
          sendMessage.mutate(blob);
        };
        mr.start();
        mediaRecorderRef.current = mr;
        setIsRecording(true);
      } catch {
        alert('Microphone access denied');
      }
    }
  }

  function togglePlay(msgId: string, url: string) {
    if (playingId === msgId) {
      audioRefs.current[msgId]?.pause();
      setPlayingId(null);
    } else {
      if (playingId && audioRefs.current[playingId]) {
        audioRefs.current[playingId].pause();
      }
      if (!audioRefs.current[msgId]) {
        const audio = new Audio(url);
        audio.onended = () => setPlayingId(null);
        audioRefs.current[msgId] = audio;
      }
      audioRefs.current[msgId].play();
      setPlayingId(msgId);
    }
  }

  const voiceMessages = (messagesList ?? []).filter(
    (m: any) => m.attachments?.some((a: any) => a.contentType?.startsWith('audio')),
  );

  const textChannels = (channels ?? []).filter((c: any) => c.type === 'GUILD_TEXT');
  const voiceChannels = (channels ?? []).filter((c: any) => c.type === 'GUILD_VOICE');

  return (
    <div style={S.page}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.sidebarTitle}>{channel?.name ?? 'Voice Messages'}</div>

        <div style={S.sidebarSection}>Text Channels</div>
        {textChannels.slice(0, 6).map((c: any) => (
          <div key={c.id} style={c.id === channelId ? S.channelItemActive : S.channelItem}>
            <span style={{ color: 'var(--text-muted)' }}>#</span> {c.name}
          </div>
        ))}

        <div style={{ ...S.sidebarSection, marginTop: 8 }}>Voice Channels</div>
        {voiceChannels.slice(0, 4).map((c: any) => (
          <div key={c.id} style={S.channelItem}>
            <span>🔊</span> {c.name}
          </div>
        ))}
      </aside>

      {/* Main */}
      <div style={S.main}>
        <div style={S.topbar}>
          <span style={S.topbarIcon}>🎙</span>
          <span style={S.topbarTitle}>{channel?.name ?? 'Voice Messages'}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
            Voice message channel
          </span>
        </div>

        <div style={S.messages}>
          {voiceMessages.length === 0 ? (
            <div style={S.empty}>
              <span style={{ fontSize: 32 }}>🎙</span>
              <span>No voice messages yet. Press the mic to record!</span>
            </div>
          ) : (
            voiceMessages.map((msg: any) => {
              const audioAttachment = msg.attachments?.find((a: any) => a.contentType?.startsWith('audio'));
              const initials = (msg.author?.displayName ?? msg.author?.username ?? '?')[0].toUpperCase();
              return (
                <div key={msg.id} style={S.messageRow}>
                  <div style={S.messageAvatar}>{initials}</div>
                  <div style={S.messageBubble}>
                    <div style={S.messageSender}>{msg.author?.displayName ?? msg.author?.username}</div>
                    <div style={S.voiceWaveform}>
                      <button
                        style={S.playBtn}
                        onClick={() => togglePlay(msg.id, audioAttachment.url)}
                        aria-label={playingId === msg.id ? 'Pause' : 'Play'}
                      >
                        {playingId === msg.id ? '⏸' : '▶'}
                      </button>
                      <WaveformBars active={playingId === msg.id} />
                      <span style={S.duration}>
                        {audioAttachment?.durationSeconds ? formatDuration(audioAttachment.durationSeconds) : '0:00'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={S.composer}>
          <input
            style={S.composerInput}
            placeholder="Add a caption (optional)…"
            aria-label="Caption"
          />
          <button
            style={isRecording ? S.micBtnRecording : S.micBtn}
            onClick={toggleRecording}
            aria-label={isRecording ? 'Stop recording' : 'Record voice message'}
            title={isRecording ? 'Stop & send' : 'Record voice message'}
          >
            {isRecording ? '⏹' : '🎙'}
          </button>
        </div>
      </div>
    </div>
  );
}
