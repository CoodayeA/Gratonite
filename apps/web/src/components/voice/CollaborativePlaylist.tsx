import { useState, useEffect, useCallback } from 'react';
import { ListMusic, Plus, Trash2, ThumbsDown, ThumbsUp, SkipForward, Music, X, Play } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';
import { getSocket, onPlaylistUpdate, onPlaylistVote } from '../../lib/socket';

interface PlaylistData {
  id: string;
  channelId: string;
  name: string;
  createdBy: string;
  isActive: boolean;
  currentTrackId: string | null;
  createdAt: string;
}

interface TrackData {
  id: string;
  playlistId: string;
  url: string;
  title: string;
  artist: string | null;
  thumbnail: string | null;
  duration: number;
  addedBy: string;
  addedByUsername: string;
  addedByDisplayName: string;
  position: number;
  played: boolean;
  skipped: boolean;
  votes: { skip: number; keep: number };
}

interface CollaborativePlaylistProps {
  channelId: string;
  currentUserId: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CollaborativePlaylist({ channelId, currentUserId }: CollaborativePlaylistProps) {
  const { addToast } = useToast();
  const [playlists, setPlaylists] = useState<PlaylistData[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistData | null>(null);
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addArtist, setAddArtist] = useState('');
  const [createName, setCreateName] = useState('');

  const fetchPlaylists = useCallback(async () => {
    try {
      const data = await api.get(`/channels/${channelId}/playlists`) as PlaylistData[];
      setPlaylists(data);
      if (data.length > 0 && !selectedPlaylist) {
        setSelectedPlaylist(data[0]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [channelId, selectedPlaylist]);

  const fetchTracks = useCallback(async () => {
    if (!selectedPlaylist) return;
    try {
      const data = await api.get(`/channels/${channelId}/playlists/${selectedPlaylist.id}/tracks`) as { tracks: TrackData[]; currentTrackId: string | null };
      setTracks(data.tracks);
      setCurrentTrackId(data.currentTrackId);
    } catch {
      // ignore
    }
  }, [channelId, selectedPlaylist]);

  useEffect(() => { fetchPlaylists(); }, [fetchPlaylists]);
  useEffect(() => { fetchTracks(); }, [fetchTracks]);

  // Real-time updates
  useEffect(() => {
    const unsub1 = onPlaylistUpdate((payload) => {
      if (payload.channelId !== channelId) return;
      fetchTracks();
    });
    const unsub2 = onPlaylistVote((payload) => {
      if (payload.channelId !== channelId) return;
      setTracks(prev => prev.map(t =>
        t.id === payload.trackId
          ? {
              ...t,
              votes: {
                skip: t.votes.skip + (payload.vote === 'skip' ? 1 : 0),
                keep: t.votes.keep + (payload.vote === 'keep' ? 1 : 0),
              },
            }
          : t
      ));
    });
    return () => { unsub1(); unsub2(); };
  }, [channelId, fetchTracks]);

  const createPlaylist = async () => {
    if (!createName.trim()) return;
    try {
      const data = await api.post(`/channels/${channelId}/playlists`, { name: createName.trim() }) as PlaylistData;
      setPlaylists(prev => [...prev, data]);
      setSelectedPlaylist(data);
      setShowCreatePlaylist(false);
      setCreateName('');
      addToast({ title: 'Playlist created', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to create playlist', variant: 'error' });
    }
  };

  const addTrack = async () => {
    if (!addUrl.trim() || !addTitle.trim() || !selectedPlaylist) return;
    try {
      await api.post(`/channels/${channelId}/playlists/${selectedPlaylist.id}/tracks`, {
        url: addUrl.trim(),
        title: addTitle.trim(),
        artist: addArtist.trim() || undefined,
      });
      getSocket()?.emit('PLAYLIST_UPDATE', {
        channelId,
        playlistId: selectedPlaylist.id,
        action: 'track_added',
      });
      setShowAddTrack(false);
      setAddUrl('');
      setAddTitle('');
      setAddArtist('');
      fetchTracks();
      addToast({ title: 'Track added', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to add track', variant: 'error' });
    }
  };

  const removeTrack = async (trackId: string) => {
    if (!selectedPlaylist) return;
    try {
      await api.delete(`/channels/${channelId}/playlists/${selectedPlaylist.id}/tracks/${trackId}`);
      getSocket()?.emit('PLAYLIST_UPDATE', {
        channelId,
        playlistId: selectedPlaylist.id,
        action: 'track_removed',
      });
      setTracks(prev => prev.filter(t => t.id !== trackId));
    } catch {
      addToast({ title: 'Failed to remove track', variant: 'error' });
    }
  };

  const voteTrack = async (trackId: string, vote: 'skip' | 'keep') => {
    if (!selectedPlaylist) return;
    try {
      const result = await api.post(`/channels/${channelId}/playlists/${selectedPlaylist.id}/tracks/${trackId}/vote`, { vote }) as { votes: { skip: number; keep: number }; skipped: boolean };
      getSocket()?.emit('PLAYLIST_VOTE', { channelId, trackId, vote });
      setTracks(prev => prev.map(t =>
        t.id === trackId ? { ...t, votes: result.votes, skipped: result.skipped } : t
      ));
    } catch {
      addToast({ title: 'Failed to vote', variant: 'error' });
    }
  };

  const nextTrack = async () => {
    if (!selectedPlaylist) return;
    try {
      const result = await api.post(`/channels/${channelId}/playlists/${selectedPlaylist.id}/next`, {}) as { next: TrackData | null };
      getSocket()?.emit('PLAYLIST_UPDATE', {
        channelId,
        playlistId: selectedPlaylist.id,
        action: 'next_track',
        track: result.next,
      });
      fetchTracks();
    } catch {
      addToast({ title: 'Failed to skip', variant: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-[var(--text-secondary)]">
        <ListMusic className="w-5 h-5 mr-2 animate-pulse" /> Loading playlists...
      </div>
    );
  }

  const currentTrack = tracks.find(t => t.id === currentTrackId);
  const upcomingTracks = tracks.filter(t => !t.played && !t.skipped && t.id !== currentTrackId);

  return (
    <div className="flex flex-col h-full">
      {/* Playlist selector */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <ListMusic className="w-4 h-4 text-[var(--text-secondary)]" />
        {playlists.length > 0 ? (
          <select
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none"
            value={selectedPlaylist?.id || ''}
            onChange={e => {
              const pl = playlists.find(p => p.id === e.target.value);
              if (pl) setSelectedPlaylist(pl);
            }}
          >
            {playlists.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : (
          <span className="flex-1 text-sm text-[var(--text-secondary)]">No playlists</span>
        )}
        <button
          className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
          onClick={() => setShowCreatePlaylist(true)}
          title="New playlist"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Create playlist modal */}
      {showCreatePlaylist && (
        <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-tertiary)] flex gap-2">
          <input
            className="flex-1 px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)]"
            placeholder="Playlist name"
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createPlaylist()}
          />
          <button
            className="px-2 py-1 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-500"
            onClick={createPlaylist}
          >
            Create
          </button>
          <button
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            onClick={() => setShowCreatePlaylist(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {selectedPlaylist && (
        <>
          {/* Now playing */}
          {currentTrack && (
            <div className="px-3 py-3 border-b border-[var(--border)] bg-gradient-to-r from-indigo-900/20 to-transparent">
              <div className="text-[10px] uppercase text-indigo-400 font-medium mb-1">Now Playing</div>
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-indigo-400 animate-pulse shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">{currentTrack.title}</div>
                  {currentTrack.artist && (
                    <div className="text-xs text-[var(--text-secondary)]">{currentTrack.artist}</div>
                  )}
                </div>
                <button
                  className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                  onClick={nextTrack}
                  title="Skip to next"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Add track button */}
          <div className="px-3 py-2 border-b border-[var(--border)]">
            {showAddTrack ? (
              <div className="flex flex-col gap-2">
                <input
                  className="px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)]"
                  placeholder="Track URL"
                  value={addUrl}
                  onChange={e => setAddUrl(e.target.value)}
                />
                <input
                  className="px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)]"
                  placeholder="Track title"
                  value={addTitle}
                  onChange={e => setAddTitle(e.target.value)}
                />
                <input
                  className="px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)]"
                  placeholder="Artist (optional)"
                  value={addArtist}
                  onChange={e => setAddArtist(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    className="flex-1 px-2 py-1.5 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-500"
                    onClick={addTrack}
                  >
                    Add Track
                  </button>
                  <button
                    className="px-2 py-1.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-xs"
                    onClick={() => setShowAddTrack(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="w-full px-3 py-2 rounded border border-dashed border-[var(--border)] text-xs text-[var(--text-secondary)] hover:border-indigo-400 hover:text-indigo-400 transition-colors flex items-center justify-center gap-1"
                onClick={() => setShowAddTrack(true)}
              >
                <Plus className="w-3 h-3" /> Add a track
              </button>
            )}
          </div>

          {/* Queue */}
          <div className="flex-1 overflow-y-auto">
            {upcomingTracks.length === 0 && !currentTrack && (
              <div className="flex flex-col items-center justify-center p-8 text-[var(--text-secondary)]">
                <Music className="w-8 h-8 mb-2" />
                <p className="text-sm">Queue is empty</p>
                <p className="text-xs">Add some tracks to get started</p>
              </div>
            )}
            {upcomingTracks.length > 0 && (
              <div className="px-3 py-1">
                <div className="text-[10px] uppercase text-[var(--text-secondary)] font-medium py-1">
                  Up Next ({upcomingTracks.length})
                </div>
              </div>
            )}
            {upcomingTracks.map((track, i) => (
              <div
                key={track.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-secondary)] group"
              >
                <span className="text-xs text-[var(--text-secondary)] w-5 text-center">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[var(--text-primary)] truncate">{track.title}</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {track.artist && `${track.artist} · `}
                    Added by {track.addedByDisplayName || track.addedByUsername}
                    {track.duration > 0 && ` · ${formatDuration(track.duration)}`}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-1 rounded hover:bg-green-500/20 text-green-400"
                    onClick={() => voteTrack(track.id, 'keep')}
                    title={`Keep (${track.votes.keep})`}
                  >
                    <ThumbsUp className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    {track.votes.keep}
                  </span>
                  <button
                    className="p-1 rounded hover:bg-red-500/20 text-red-400"
                    onClick={() => voteTrack(track.id, 'skip')}
                    title={`Skip (${track.votes.skip})`}
                  >
                    <ThumbsDown className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    {track.votes.skip}
                  </span>
                  {track.addedBy === currentUserId && (
                    <button
                      className="p-1 rounded hover:bg-red-500/20 text-red-400"
                      onClick={() => removeTrack(track.id)}
                      title="Remove"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Start playing if no current track but tracks available */}
          {!currentTrack && upcomingTracks.length > 0 && (
            <div className="px-3 py-2 border-t border-[var(--border)]">
              <button
                className="w-full px-3 py-2 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2"
                onClick={nextTrack}
              >
                <Play className="w-4 h-4" /> Start Playing
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
