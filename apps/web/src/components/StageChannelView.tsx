import { useEffect, useState, useMemo, useCallback } from 'react';
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
    () => Array.from(new Set(states.map((s) => String(s.userId)))),
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
      await api.voice.createStageInstance(guildId, {
        channelId,
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
  const currentUserState = states.find((s) => s.userId === currentUserId);
  const hasRaisedHand = Boolean(currentUserState?.requestToSpeakTimestamp);
  const isSpeaker = currentUserState ? !currentUserState.suppress : false;

  return (
    <div className="stage-channel-view">
      {/* Stage header */}
      <div className="stage-header">
        <div className="stage-header-info">
          <h2 className="stage-title">🎙 {channelName}</h2>
          {stageInstance && (
            <p className="stage-topic">{stageInstance.topic}</p>
          )}
          {!stageInstance && (
            <p className="server-settings-muted">No active stage. Start one below.</p>
          )}
        </div>
        <div className="stage-header-actions">
          {stageInstance && (
            <Button variant="danger" size="sm" onClick={handleEndStage}>
              End Stage
            </Button>
          )}
        </div>
      </div>

      {error && <div className="modal-error">{error}</div>}
      {feedback && (
        <div className="server-settings-feedback" role="status" aria-live="polite">
          {feedback}
        </div>
      )}

      {/* Start stage form (when no active stage) */}
      {!stageInstance && (
        <div className="channel-permission-card" style={{ marginBottom: 16 }}>
          <div className="channel-permission-title">Start a Stage</div>
          <div className="channel-permission-row" style={{ marginBottom: 8 }}>
            <input
              className="input-field"
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
      <div className="stage-connection" style={{ marginBottom: 16 }}>
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
          <div className="server-settings-inline-stats">
            <Button variant="ghost" size="sm" onClick={() => toggleMute()}>
              {muted ? '🔇 Unmute' : '🔊 Mute'}
            </Button>
            {!isSpeaker && !hasRaisedHand && stageInstance && (
              <Button variant="primary" size="sm" onClick={handleRequestToSpeak}>
                ✋ Raise Hand
              </Button>
            )}
            {hasRaisedHand && !isSpeaker && (
              <span className="server-settings-stat-pill">✋ Hand Raised</span>
            )}
            {isSpeaker && (
              <span className="server-settings-stat-pill" style={{ color: '#6aea8a' }}>🎤 Speaking</span>
            )}
            <Button variant="danger" size="sm" onClick={handleLeaveStage}>
              Leave
            </Button>
          </div>
        )}
      </div>

      {/* Speaker queue (hand raises) */}
      {handRaised.length > 0 && (
        <div className="channel-permission-card" style={{ marginBottom: 16 }}>
          <div className="channel-permission-title">
            ✋ Hand Raised ({handRaised.length})
          </div>
          <div className="channel-permission-list">
            {handRaised.map((state) => (
              <div key={state.userId} className="channel-permission-item">
                <span className="channel-permission-target">
                  {getUserLabel(state.userId)}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
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
      <div className="channel-permission-card" style={{ marginBottom: 16 }}>
        <div className="channel-permission-title">
          🎤 Speakers ({speakers.length})
        </div>
        {speakers.length === 0 ? (
          <div className="server-settings-muted">No speakers yet.</div>
        ) : (
          <div className="stage-participants-grid">
            {speakers.map((state) => (
              <div key={state.userId} className="stage-participant-card stage-participant-speaker">
                <div className="stage-participant-avatar">🎤</div>
                <div className="stage-participant-name">{getUserLabel(state.userId)}</div>
                {state.selfMute && <span className="stage-participant-badge">Muted</span>}
                {state.userId !== currentUserId && (
                  <button
                    type="button"
                    className="channel-permission-remove"
                    onClick={() => handleRemoveSpeaker(state.userId)}
                    style={{ marginTop: 4 }}
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
      <div className="channel-permission-card">
        <div className="channel-permission-title">
          👥 Audience ({audience.length})
        </div>
        {audience.length === 0 ? (
          <div className="server-settings-muted">No audience members.</div>
        ) : (
          <div className="stage-participants-grid">
            {audience.map((state) => (
              <div key={state.userId} className="stage-participant-card stage-participant-audience">
                <div className="stage-participant-avatar">👤</div>
                <div className="stage-participant-name">{getUserLabel(state.userId)}</div>
                {state.requestToSpeakTimestamp && (
                  <span className="stage-participant-badge">✋</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
