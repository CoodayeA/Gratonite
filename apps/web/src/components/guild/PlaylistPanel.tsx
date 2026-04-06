/**
 * 117. Shared Playlists — Frontend playlist UI with voting.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Music, ThumbsUp, ThumbsDown, SkipForward, Trash2, Play, ListMusic } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface Track { id: string; url: string; title: string; artist: string | null; duration: number; addedByUsername: string; played: boolean; skipped: boolean; votes: { skip: number; keep: number }; }

export default function PlaylistPanel({ channelId }: { channelId: string }) {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ url: '', title: '', artist: '' });
  const { addToast } = useToast();

  const fetchPlaylists = useCallback(async () => {
    try { setPlaylists(await api.playlists.list(channelId)); } catch {}
  }, [channelId]);

  useEffect(() => { fetchPlaylists(); }, [fetchPlaylists]);

  const fetchTracks = useCallback(async (playlistId: string) => {
    try {
      const data = await api.playlists.getTracks(channelId, playlistId);
      setTracks(data.tracks || []);
      setCurrentTrackId(data.currentTrackId);
    } catch { addToast({ title: 'Failed to load tracks', variant: 'error' }); }
  }, [channelId]);

  useEffect(() => { if (activePlaylist) fetchTracks(activePlaylist); }, [activePlaylist, fetchTracks]);

  const createPlaylist = async () => {
    if (!newName.trim()) return;
    try {
      const p = await api.playlists.create(channelId, newName);
      setPlaylists(prev => [...prev, p]);
      setActivePlaylist(p.id);
      setNewName('');
    } catch { addToast({ title: 'Failed to create playlist', variant: 'error' }); }
  };

  const addTrack = async () => {
    if (!addForm.url || !addForm.title || !activePlaylist) return;
    try {
      await api.playlists.addTrack(channelId, activePlaylist, addForm);
      setShowAdd(false);
      setAddForm({ url: '', title: '', artist: '' });
      fetchTracks(activePlaylist);
    } catch { addToast({ title: 'Failed to add track', variant: 'error' }); }
  };

  const vote = async (trackId: string, v: 'skip' | 'keep') => {
    if (!activePlaylist) return;
    try { await api.playlists.vote(channelId, activePlaylist, trackId, v); fetchTracks(activePlaylist); } catch { addToast({ title: 'Failed to vote on track', variant: 'error' }); }
  };

  const nextTrack = async () => {
    if (!activePlaylist) return;
    try { await api.playlists.next(channelId, activePlaylist); fetchTracks(activePlaylist); } catch { addToast({ title: 'Failed to skip track', variant: 'error' }); }
  };

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium flex items-center gap-2"><ListMusic className="w-5 h-5 text-purple-400" /> Playlists</h3>
      </div>

      {/* Playlist tabs */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {playlists.map(p => (
          <button key={p.id} onClick={() => setActivePlaylist(p.id)} className={`px-3 py-1 text-sm rounded flex-shrink-0 ${activePlaylist === p.id ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {p.name}
          </button>
        ))}
        <div className="flex items-center gap-1 flex-shrink-0">
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createPlaylist()} placeholder="New playlist..." className="bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-700 w-28" />
          <button onClick={createPlaylist} className="p-1 bg-purple-600 hover:bg-purple-500 text-white rounded"><Plus className="w-4 h-4" /></button>
        </div>
      </div>

      {activePlaylist && (
        <>
          {/* Now playing */}
          {currentTrackId && (
            <div className="p-3 bg-purple-900/30 border border-purple-800 rounded-lg mb-3 flex items-center gap-3">
              <Music className="w-5 h-5 text-purple-400 animate-pulse" />
              <div className="flex-1">
                <p className="text-sm text-white font-medium">{tracks.find(t => t.id === currentTrackId)?.title || 'Unknown'}</p>
                <p className="text-xs text-gray-400">{tracks.find(t => t.id === currentTrackId)?.artist || ''}</p>
              </div>
              <button onClick={nextTrack} className="p-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded">
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Tracks */}
          <div className="space-y-1 mb-3 max-h-[300px] overflow-y-auto">
            {tracks.filter(t => !t.played && !t.skipped).map((track, i) => (
              <div key={track.id} className={`flex items-center gap-2 p-2 rounded-lg ${track.id === currentTrackId ? 'bg-purple-900/20' : 'hover:bg-gray-800'}`}>
                <span className="text-xs text-gray-500 w-5 text-right">{i + 1}</span>
                <Music className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{track.title}</p>
                  <p className="text-xs text-gray-500">{track.artist || 'Unknown'} - added by {track.addedByUsername}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => vote(track.id, 'keep')} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-800 hover:bg-green-900 text-gray-400 hover:text-green-400 rounded text-xs">
                    <ThumbsUp className="w-3 h-3" /> {track.votes?.keep || 0}
                  </button>
                  <button onClick={() => vote(track.id, 'skip')} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-red-400 rounded text-xs">
                    <ThumbsDown className="w-3 h-3" /> {track.votes?.skip || 0}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add track */}
          {showAdd ? (
            <div className="space-y-2 p-3 bg-gray-800 rounded-lg">
              <input value={addForm.url} onChange={e => setAddForm({ ...addForm, url: e.target.value })} placeholder="Audio URL" className="w-full bg-gray-700 text-white text-sm rounded px-3 py-1.5 border border-gray-600" />
              <input value={addForm.title} onChange={e => setAddForm({ ...addForm, title: e.target.value })} placeholder="Title" className="w-full bg-gray-700 text-white text-sm rounded px-3 py-1.5 border border-gray-600" />
              <input value={addForm.artist} onChange={e => setAddForm({ ...addForm, artist: e.target.value })} placeholder="Artist (optional)" className="w-full bg-gray-700 text-white text-sm rounded px-3 py-1.5 border border-gray-600" />
              <div className="flex gap-2">
                <button onClick={addTrack} className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded">Add Track</button>
                <button onClick={() => setShowAdd(false)} className="text-sm text-gray-400">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded text-sm w-full">
              <Plus className="w-4 h-4" /> Add Track
            </button>
          )}
        </>
      )}
    </div>
  );
}
