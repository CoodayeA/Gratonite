import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useVoiceStore } from '@/stores/voice.store';
import { useChannelsStore } from '@/stores/channels.store';
import { joinVoiceChannel, leaveVoiceChannel, toggleMute } from '@/lib/dmCall';
import { useCallStore } from '@/stores/call.store';
import type { VoiceState } from '@gratonite/types';

const styles = {
  view: {
    flex: 1,
    padding: 24,
    overflowY: 'auto',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 16,
  } as React.CSSProperties,

  headerInfo: {
    flex: 1,
  } as React.CSSProperties,

  title: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text)',
    margin: '0 0 4px',
  } as React.CSSProperties,

  topic: {
    fontSize: 14,
    color: 'var(--text-muted)',
    margin: 0,
  } as React.CSSProperties,

  muted: {
    color: 'var(--text-faint)',
    fontSize: 13,
  } as React.CSSProperties,

  headerActions: {
    display: 'flex',
    gap: 8,
  } as React.CSSProperties,

  connection: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  } as React.CSSProperties,

  error: {
    background: 'rgba(255, 107, 107, 0.1)',
    border: '1px solid rgba(255, 107, 107, 0.3)',
    color: '#ffd2d2',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    fontSize: 13,
    marginBottom: 12,
  } as React.CSSProperties,

  feedback: {
    background: 'rgba(106, 234, 138, 0.1)',
    border: '1px solid rgba(106, 234, 138, 0.3)',
    color: '#b8ffc8',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    fontSize: 13,
    marginBottom: 12,
  } as React.CSSProperties,

  card: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-lg)',
    padding: 16,
    marginBottom: 16,
  } as React.CSSProperties,

  cardLast: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-lg)',
    padding: 16,
  } as React.CSSProperties,

  cardTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 8,
  } as React.CSSProperties,

  inputField: {
    background: 'var(--bg-input)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    padding: '8px 12px',
    fontSize: 14,
    width: '100%',
  } as React.CSSProperties,

  permissionRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  } as React.CSSProperties,

  permissionList: {
    display: 'grid',
    gap: 6,
  } as React.CSSProperties,

  permissionItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '6px 0',
  } as React.CSSProperties,

  permissionTarget: {
    fontSize: 13,
    color: 'var(--text)',
  } as React.CSSProperties,

  ghostBtn: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--stroke)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-md)',
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
  } as React.CSSProperties,

  inlineStats: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  } as React.CSSProperties,

  statPill: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 12,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-pill)',
    padding: '4px 10px',
    color: 'var(--text-muted)',
  } as React.CSSProperties,

  participantsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 10,
    marginTop: 8,
  } as React.CSSProperties,

  participantCard: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 10,
    padding: 12,
    textAlign: 'center',
  } as React.CSSProperties,

  participantSpeaker: {
    background: 'var(--bg-elevated)',
    border: '1px solid rgba(106, 234, 138, 0.4)',
    borderRadius: 10,
    padding: 12,
    textAlign: 'center',
  } as React.CSSProperties,

  participantAudience: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 10,
    padding: 12,
    textAlign: 'center',
  } as React.CSSProperties,

  participantAvatar: {
    fontSize: 28,
    marginBottom: 4,
  } as React.CSSProperties,

  participantName: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  participantBadge: {
    display: 'inline-block',
    fontSize: 11,
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-md)',
    padding: '1px 6px',
    marginTop: 4,
    color: 'var(--text-muted)',
  } as React.CSSProperties,

  removeBtn: {
    background: 'none',
    border: '1px solid rgba(255, 107, 107, 0.3)',
    color: '#ffb4b4',
    borderRadius: 'var(--radius-sm)',
    padding: '2px 8px',
    fontSize: 11,
    cursor: 'pointer',
    marginTop: 4,
  } as React.CSSProperties,
};

interface StageChannelViewProps {
  channelId: string;
  channelName: string;
}

const EMPTY_STATES: VoiceState[] = [];

interface StageInstance {
  id: string;
  guildId: string;
  channelId: string;
  topic: string;
  privacyLevel: 'public' | 'guild_only';
  scheduledEventId: string | null;
}

export function StageChannelView({ channelId, channelName }: StageChannelViewProps) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const callStatus = useCallStore((s) => s.status);
  const callChannelId = useCallStore((s) => s.channelId);
  const muted = useCallStore((s) => s.muted);
  const channel = useChannelsStore((s) => s.channels.get(channelId));
  const guildId = channel?.guildId ?? null;
  const states = useVoiceStore((s) => s.statesByChannel.get(channelId) ?? EMPTY_STATES);

  const isConnected = callStatus === 'connected' && callChannelId === channelId;
  const isConnecting = callStatus === 'connecting' && callChannelId === channelId;

  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [creatingStage, setCreatingStage] = useState(false);

  // Fetch stage instances for this guild
  const { data: stageInstances = [] } = useQuery({
    queryKey: ['stage-instances', guildId],
    queryFn: () => (guildId ? api.voice.getStageInstances(guildId) : Promise.resolve([])),
    enabled: Boolean(guildId),
    refetchInterval: 15_000,
  });

  // Find the stage instance for this channel
  const stageInstance = useMemo(
    () => stageInstances.find((si: StageInstance) => si.channelId === channelId) ?? null,
    [stageInstances, channelId],
  );

  // Fetch user summaries for voice participants
  const voiceUserIds = useMemo(
    () => Array.from(new Set(states.map((st) => String(st.userId)))),
    [states],
  );

  const { data: voiceUserSummaries = [] } = useQuery({
    queryKey: ['stage-channel-users', channelId, voiceUserIds],
    queryFn: () => api.users.getSummaries(voiceUserIds),
    enabled: voiceUserIds.length > 0,
    staleTime: 60_000,
  });

  const userMap = useMemo(() => {
    const map = new Map<string, { username: string; displayName: string; avatarHash: string | null }>();
    voiceUserSummaries.forEach((u) => map.set(u.id, u));
    return map;
  }, [voiceUserSummaries]);

  // Categorize participants: speakers (not suppressed) and audience (suppressed)
  const { speakers, audience, handRaised } = useMemo(() => {
    const spk: VoiceState[] = [];
    const aud: VoiceState[] = [];
    const raised: VoiceState[] = [];

    for (const state of states) {
      if (state.requestToSpeakTimestamp) {
        raised.push(state);
      }
      if (!state.suppress) {
        spk.push(state);
      } else {
        aud.push(state);
      }
    }

    return { speakers: spk, audience: aud, handRaised: raised };
  }, [states]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(''), 2500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const handleJoinStage = useCallback(async () => {
    setError('');
    try {
      await joinVoiceChannel(channelId);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [channelId]);

  const handleLeaveStage = useCallback(async () => {
    try {
      await leaveVoiceChannel();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  const handleRequestToSpeak = useCallback(async () => {
    if (!stageInstance) return;
    setError('');
    try {
      await api.voice.requestToSpeak(stageInstance.id);
      setFeedback('Hand raised! Waiting for a speaker to invite you.');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [stageInstance]);

  const handleInviteSpeaker = useCallback(async (userId: string) => {
    if (!stageInstance) return;
    setError('');
    try {
      await api.voice.addSpeaker(stageInstance.id, userId);
      await queryClient.invalidateQueries({ queryKey: ['stage-instances', guildId] });
      setFeedback('Speaker added to stage.');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [stageInstance, guildId, queryClient]);

  const handleRemoveSpeaker = useCallback(async (userId: string) => {
    if (!stageInstance) return;
    setError('');
    try {
      await api.voice.removeSpeaker(stageInstance.id, userId);
      await queryClient.invalidateQueries({ queryKey: ['stage-instances', guildId] });
      setFeedback('Speaker removed from stage.');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [stageInstance, guildId, queryClient]);

  async function handleStartStage() {
    if (!guildId || !newTopic.trim()) return;
    setCreatingStage(true);
    setError('');
    try {
      await api.voice.createStageInstance(channelId, {
        topic: newTopic.trim(),
      });
      setNewTopic('');
      await queryClient.invalidateQueries({ queryKey: ['stage-instances', guildId] });
      setFeedback('Stage started!');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreatingStage(false);
    }
  }

  async function handleEndStage() {
    if (!stageInstance) return;
    if (!window.confirm('End this stage? All participants will be returned to audience.')) return;
    try {
      await api.voice.deleteStageInstance(stageInstance.id);
      await queryClient.invalidateQueries({ queryKey: ['stage-instances', guildId] });
      setFeedback('Stage ended.');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function getUserLabel(userId: string) {
    const summary = userMap.get(userId);
    return summary?.displayName ?? summary?.username ?? `User ${userId.slice(-4)}`;
  }

  // Check if current user has raised hand
  const currentUserState = states.find((st) => st.userId === currentUserId);
  const hasRaisedHand = Boolean(currentUserState?.requestToSpeakTimestamp);
  const isSpeaker = currentUserState ? !currentUserState.suppress : false;

  return (
    <div style={styles.view}>
      {/* Stage header */}
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          <h2 style={styles.title}>{'\uD83C\uDF99'} {channelName}</h2>
          {stageInstance && (
            <p style={styles.topic}>{stageInstance.topic}</p>
          )}
          {!stageInstance && (
            <p style={styles.muted}>No active stage. Start one below.</p>
          )}
        </div>
        <div style={styles.headerActions}>
          {stageInstance && (
            <Button variant="danger" size="sm" onClick={handleEndStage}>
              End Stage
            </Button>
          )}
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {feedback && (
        <div style={styles.feedback} role="status" aria-live="polite">
          {feedback}
        </div>
      )}

      {/* Start stage form (when no active stage) */}
      {!stageInstance && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Start a Stage</div>
          <div style={styles.permissionRow}>
            <input
              style={styles.inputField}
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder="What's the topic? (e.g. AMA, Community Q&A)"
              maxLength={120}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleStartStage();
              }}
            />
            <Button
              type="button"
              onClick={handleStartStage}
              loading={creatingStage}
              disabled={!newTopic.trim()}
            >
              Start
            </Button>
          </div>
        </div>
      )}

      {/* Connection controls */}
      <div style={styles.connection}>
        {!isConnected && !isConnecting && (
          <Button variant="primary" onClick={handleJoinStage}>
            Join Stage
          </Button>
        )}
        {isConnecting && (
          <Button variant="ghost" disabled>
            Connecting...
          </Button>
        )}
        {isConnected && (
          <div style={styles.inlineStats}>
            <Button variant="ghost" size="sm" onClick={() => toggleMute()}>
              {muted ? '\uD83D\uDD07 Unmute' : '\uD83D\uDD0A Mute'}
            </Button>
            {!isSpeaker && !hasRaisedHand && stageInstance && (
              <Button variant="primary" size="sm" onClick={handleRequestToSpeak}>
                {'\u270B'} Raise Hand
              </Button>
            )}
            {hasRaisedHand && !isSpeaker && (
              <span style={styles.statPill}>{'\u270B'} Hand Raised</span>
            )}
            {isSpeaker && (
              <span style={{ ...styles.statPill, color: '#6aea8a' }}>{'\uD83C\uDF99'} Speaking</span>
            )}
            <Button variant="danger" size="sm" onClick={handleLeaveStage}>
              Leave
            </Button>
          </div>
        )}
      </div>

      {/* Speaker queue (hand raises) */}
      {handRaised.length > 0 && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>
            {'\u270B'} Hand Raised ({handRaised.length})
          </div>
          <div style={styles.permissionList}>
            {handRaised.map((state) => (
              <div key={state.userId} style={styles.permissionItem}>
                <span style={styles.permissionTarget}>
                  {getUserLabel(state.userId)}
                </span>
                <button
                  type="button"
                  style={styles.ghostBtn}
                  onClick={() => handleInviteSpeaker(state.userId)}
                >
                  Invite to Speak
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Speakers section */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>
          {'\uD83C\uDF99'} Speakers ({speakers.length})
        </div>
        {speakers.length === 0 ? (
          <div style={styles.muted}>No speakers yet.</div>
        ) : (
          <div style={styles.participantsGrid}>
            {speakers.map((state) => (
              <div key={state.userId} style={styles.participantSpeaker}>
                <div style={styles.participantAvatar}>{'\uD83C\uDF99'}</div>
                <div style={styles.participantName}>{getUserLabel(state.userId)}</div>
                {state.selfMute && <span style={styles.participantBadge}>Muted</span>}
                {state.userId !== currentUserId && (
                  <button
                    type="button"
                    style={styles.removeBtn}
                    onClick={() => handleRemoveSpeaker(state.userId)}
                  >
                    Move to Audience
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audience section */}
      <div style={styles.cardLast}>
        <div style={styles.cardTitle}>
          {'\uD83D\uDC65'} Audience ({audience.length})
        </div>
        {audience.length === 0 ? (
          <div style={styles.muted}>No audience members.</div>
        ) : (
          <div style={styles.participantsGrid}>
            {audience.map((state) => (
              <div key={state.userId} style={styles.participantAudience}>
                <div style={styles.participantAvatar}>{'\uD83D\uDC64'}</div>
                <div style={styles.participantName}>{getUserLabel(state.userId)}</div>
                {state.requestToSpeakTimestamp && (
                  <span style={styles.participantBadge}>{'\u270B'}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
