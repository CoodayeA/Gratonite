import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, Film, Users, X, Send, SmilePlus, StopCircle, Link } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';
import { getSocket, onWatchPartySync, onWatchPartyReaction, type WatchPartySyncPayload, type WatchPartyReactionPayload } from '../../lib/socket';

interface WatchPartyData {
  id: string;
  channelId: string;
  hostId: string;
  title: string;
  videoUrl: string;
  isActive: boolean;
  currentTime: number;
  isPlaying: boolean;
  createdAt: string;
}

interface PartyMember {
  userId: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
}

interface WatchPartyProps {
  channelId: string;
  currentUserId: string;
}

const REACTION_EMOJIS = ['😂', '😮', '😢', '🔥', '👏', '❤️'];

export default function WatchParty({ channelId, currentUserId }: WatchPartyProps) {
  const { addToast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [party, setParty] = useState<WatchPartyData | null>(null);
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createUrl, setCreateUrl] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; user: string; text: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; emoji: string; x: number }>>([]);
  const [showMembers, setShowMembers] = useState(false);
  const ignoreNextSync = useRef(false);

  const isHost = party?.hostId === currentUserId;

  const fetchParty = useCallback(async () => {
    try {
      const data = await api.get(`/channels/${channelId}/watch-party`) as { party: WatchPartyData | null; members: PartyMember[] };
      setParty(data.party);
      setMembers(data.members);
    } catch {
      // Channel might not have a party
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => { fetchParty(); }, [fetchParty]);

  // Listen for sync events from the host
  useEffect(() => {
    if (!party) return;
    const unsub = onWatchPartySync((payload: WatchPartySyncPayload) => {
      if (payload.channelId !== channelId || payload.partyId !== party.id) return;
      if (payload.userId === currentUserId) return; // ignore own events
      const video = videoRef.current;
      if (!video) return;

      ignoreNextSync.current = true;
      if (payload.action === 'seek') {
        video.currentTime = payload.currentTime;
      } else if (payload.action === 'play') {
        video.currentTime = payload.currentTime;
        video.play().catch(() => {});
      } else if (payload.action === 'pause') {
        video.currentTime = payload.currentTime;
        video.pause();
      }
      setTimeout(() => { ignoreNextSync.current = false; }, 200);
    });
    return unsub;
  }, [party, channelId, currentUserId]);

  // Listen for reactions
  useEffect(() => {
    if (!party) return;
    const unsub = onWatchPartyReaction((payload: WatchPartyReactionPayload) => {
      if (payload.channelId !== channelId) return;
      const id = `${Date.now()}-${Math.random()}`;
      const x = 10 + Math.random() * 80;
      setFloatingReactions(prev => [...prev, { id, emoji: payload.emoji, x }]);
      setTimeout(() => {
        setFloatingReactions(prev => prev.filter(r => r.id !== id));
      }, 2000);
    });
    return unsub;
  }, [party, channelId]);

  const emitSync = (action: 'play' | 'pause' | 'seek', currentTime: number) => {
    if (!party || !isHost || ignoreNextSync.current) return;
    getSocket()?.emit('WATCH_PARTY_SYNC', {
      channelId,
      partyId: party.id,
      action,
      currentTime,
    });
  };

  const handlePlay = () => emitSync('play', videoRef.current?.currentTime ?? 0);
  const handlePause = () => emitSync('pause', videoRef.current?.currentTime ?? 0);
  const handleSeek = () => emitSync('seek', videoRef.current?.currentTime ?? 0);

  const createParty = async () => {
    if (!createTitle.trim() || !createUrl.trim()) return;
    try {
      const data = await api.post(`/channels/${channelId}/watch-party`, {
        title: createTitle.trim(),
        videoUrl: createUrl.trim(),
      }) as WatchPartyData;
      setParty(data);
      setMembers([]);
      setShowCreate(false);
      setCreateTitle('');
      setCreateUrl('');
      addToast({ title: 'Watch party started!', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to create watch party', variant: 'error' });
    }
  };

  const joinParty = async () => {
    if (!party) return;
    try {
      await api.post(`/channels/${channelId}/watch-party/${party.id}/join`, {});
      fetchParty();
    } catch {
      addToast({ title: 'Failed to join party', variant: 'error' });
    }
  };

  const leaveParty = async () => {
    if (!party) return;
    try {
      await api.post(`/channels/${channelId}/watch-party/${party.id}/leave`, {});
      fetchParty();
    } catch {
      addToast({ title: 'Failed to leave party', variant: 'error' });
    }
  };

  const endParty = async () => {
    if (!party) return;
    try {
      await api.post(`/channels/${channelId}/watch-party/${party.id}/end`, {});
      setParty(null);
      setMembers([]);
      addToast({ title: 'Watch party ended', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to end party', variant: 'error' });
    }
  };

  const sendReaction = (emoji: string) => {
    getSocket()?.emit('WATCH_PARTY_REACTION', { channelId, emoji });
    // Show locally too
    const id = `${Date.now()}-${Math.random()}`;
    const x = 10 + Math.random() * 80;
    setFloatingReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2000);
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const id = `${Date.now()}`;
    setChatMessages(prev => [...prev.slice(-50), { id, user: 'You', text: chatInput.trim() }]);
    setChatInput('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-[var(--text-secondary)]">
        <Film className="w-5 h-5 mr-2 animate-pulse" /> Loading watch party...
      </div>
    );
  }

  // No active party — show create button
  if (!party) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4">
        <Film className="w-12 h-12 text-[var(--text-secondary)]" />
        <p className="text-[var(--text-secondary)] text-sm">No active watch party in this channel</p>
        {showCreate ? (
          <div className="flex flex-col gap-2 w-full max-w-md">
            <input
              className="px-3 py-2 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)]"
              placeholder="Party title"
              value={createTitle}
              onChange={e => setCreateTitle(e.target.value)}
            />
            <input
              className="px-3 py-2 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)]"
              placeholder="Video URL (mp4, webm, etc.)"
              value={createUrl}
              onChange={e => setCreateUrl(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="flex-1 px-3 py-2 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
                onClick={createParty}
              >
                Start Party
              </button>
              <button
                className="px-3 py-2 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-sm hover:bg-[var(--bg-secondary)] transition-colors"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors flex items-center gap-2"
            onClick={() => setShowCreate(true)}
          >
            <Film className="w-4 h-4" /> Start Watch Party
          </button>
        )}
      </div>
    );
  }

  const isMember = members.some(m => m.userId === currentUserId);

  return (
    <div className="flex flex-col h-full bg-black relative">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <div className="flex items-center gap-2 min-w-0">
          <Film className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">{party.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors relative"
            onClick={() => setShowMembers(!showMembers)}
            title="Viewers"
          >
            <Users className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {members.length}
            </span>
          </button>
          {!isMember && (
            <button
              className="px-2 py-1 rounded bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 transition-colors"
              onClick={joinParty}
            >
              Join
            </button>
          )}
          {isMember && !isHost && (
            <button
              className="px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-xs hover:bg-[var(--bg-primary)] transition-colors"
              onClick={leaveParty}
            >
              Leave
            </button>
          )}
          {isHost && (
            <button
              className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
              onClick={endParty}
              title="End Party"
            >
              <StopCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Video player + chat sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Video area */}
        <div className="flex-1 relative flex flex-col">
          <video
            ref={videoRef}
            src={party.videoUrl}
            className="flex-1 w-full bg-black object-contain"
            controls={isHost}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeeked={handleSeek}
          />

          {/* Floating reactions */}
          {floatingReactions.map(r => (
            <div
              key={r.id}
              className="absolute text-2xl pointer-events-none animate-bounce"
              style={{ left: `${r.x}%`, bottom: '60px', animation: 'floatUp 2s ease-out forwards' }}
            >
              {r.emoji}
            </div>
          ))}

          {/* Reaction bar */}
          <div className="flex items-center justify-center gap-1 py-2 bg-black/80">
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                className="text-xl hover:scale-125 transition-transform px-1"
                onClick={() => sendReaction(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Sync indicator for non-host */}
          {!isHost && (
            <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white flex items-center gap-1">
              <Link className="w-3 h-3" /> Synced with host
            </div>
          )}
        </div>

        {/* Chat sidebar */}
        <div className="w-72 flex flex-col border-l border-[var(--border)] bg-[var(--bg-secondary)]">
          {showMembers ? (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase">Viewers ({members.length})</span>
                <button onClick={() => setShowMembers(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {members.map(m => (
                <div key={m.userId} className="flex items-center gap-2 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs text-[var(--text-secondary)]">
                    {m.displayName?.[0] || m.username[0]}
                  </div>
                  <span className="text-sm text-[var(--text-primary)] truncate">{m.displayName || m.username}</span>
                  {party.hostId === m.userId && (
                    <span className="text-[10px] bg-indigo-600/20 text-indigo-400 px-1 rounded">Host</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-[var(--text-secondary)] text-center mt-4">Chat while watching together</p>
                )}
                {chatMessages.map(msg => (
                  <div key={msg.id} className="text-xs">
                    <span className="font-medium text-[var(--text-primary)]">{msg.user}: </span>
                    <span className="text-[var(--text-secondary)]">{msg.text}</span>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-[var(--border)] flex gap-1">
                <input
                  className="flex-1 px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)]"
                  placeholder="Send a message..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                />
                <button
                  className="p-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                  onClick={sendChat}
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* CSS for floating reactions */}
      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-120px); }
        }
      `}</style>
    </div>
  );
}
