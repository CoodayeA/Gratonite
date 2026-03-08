import { useState, useEffect, useCallback } from 'react';
import { Music, Plus, Trash2, SkipForward, ListMusic, X, Disc3, Crown } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface Track {
  id: string;
  url: string;
  title: string;
  thumbnail: string | null;
  duration: number;
  addedBy: string;
  position: number;
}

interface MusicSettings {
  channelId: string;
  mode: string;
  currentDjId: string | null;
  volume: number;
}

interface MusicRoomProps {
  channelId: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MusicRoom({ channelId }: MusicRoomProps) {
  const { addToast } = useToast();
  const [settings, setSettings] = useState<MusicSettings | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [skipVotes, setSkipVotes] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.get(`/channels/${channelId}/music`) as { settings: MusicSettings; queue: Track[] };
      setSettings(data.settings);
      setQueue(data.queue);
    } catch {
      addToast({ title: 'Failed to load music room', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [channelId, addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addTrack = async () => {
    if (!addUrl.trim() || !addTitle.trim()) return;
    try {
      await api.post<void>(`/channels/${channelId}/music/queue`, { url: addUrl, title: addTitle });
      setAddUrl('');
      setAddTitle('');
      setShowAddModal(false);
      fetchData();
    } catch {
      addToast({ title: 'Failed to add track', variant: 'error' });
    }
  };

  const removeTrack = async (trackId: string) => {
    try {
      await api.delete<void>(`/channels/${channelId}/music/queue/${trackId}`);
      setQueue(q => q.filter(t => t.id !== trackId));
    } catch {
      addToast({ title: 'Failed to remove track', variant: 'error' });
    }
  };

  const voteSkip = async () => {
    try {
      await api.post<void>(`/channels/${channelId}/music/skip`, {});
      setSkipVotes(v => v + 1);
    } catch {
      addToast({ title: 'Failed to vote skip', variant: 'error' });
    }
  };

  const nextTrack = async () => {
    try {
      const data = await api.post(`/channels/${channelId}/music/next`, {}) as { next: Track | null };
      if (data.next) {
        fetchData();
      } else {
        setQueue([]);
      }
      setSkipVotes(0);
    } catch {
      addToast({ title: 'Failed to advance track', variant: 'error' });
    }
  };

  if (loading) {
    return <div className="p-4 text-gray-400 text-sm">Loading music room...</div>;
  }

  const currentTrack = queue[0] || null;

  return (
    <div className="flex flex-col bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      {/* Now Playing */}
      <div className="p-3 bg-gray-800 flex items-center gap-3">
        {currentTrack ? (
          <>
            {currentTrack.thumbnail ? (
              <img src={currentTrack.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
            ) : (
              <div className="w-12 h-12 rounded bg-gray-700 flex items-center justify-center">
                <Disc3 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
              <p className="text-xs text-gray-400">
                {currentTrack.duration > 0 ? formatDuration(currentTrack.duration) : 'Unknown duration'}
              </p>
            </div>
            <button onClick={voteSkip} className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded flex items-center gap-1">
              <SkipForward className="w-3 h-3" />
              Skip {skipVotes > 0 && `(${skipVotes})`}
            </button>
            {settings?.mode === 'djRotation' && (
              <button onClick={nextTrack} className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center gap-1">
                <Crown className="w-3 h-3" /> Next
              </button>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Music className="w-5 h-5" />
            <span>No track playing</span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setShowQueue(!showQueue)} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
            <ListMusic className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500">{queue.length}</span>
        </div>
      </div>

      {/* DJ Mode Indicator */}
      {settings?.mode === 'djRotation' && (
        <div className="px-3 py-1 bg-indigo-900/30 text-xs text-indigo-300 flex items-center gap-1">
          <Crown className="w-3 h-3" /> DJ Rotation Mode
        </div>
      )}

      {/* Queue Panel */}
      {showQueue && (
        <div className="border-t border-gray-700 max-h-64 overflow-y-auto">
          <div className="p-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400 uppercase">Queue ({queue.length})</span>
            <button onClick={() => setShowAddModal(true)} className="p-1 hover:bg-gray-700 rounded text-indigo-400 hover:text-indigo-300">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {queue.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-gray-500">Queue is empty. Add a track to get started.</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {queue.map((track, i) => (
                <div key={track.id} className="px-3 py-2 flex items-center gap-2 hover:bg-gray-800/50 group">
                  <span className="text-xs text-gray-500 w-5 text-right">{i + 1}</span>
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt="" className="w-8 h-8 rounded object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center">
                      <Music className="w-4 h-4 text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 truncate">{track.title}</p>
                    {track.duration > 0 && (
                      <p className="text-xs text-gray-500">{formatDuration(track.duration)}</p>
                    )}
                  </div>
                  <button onClick={() => removeTrack(track.id)} className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Track Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-gray-800 rounded-lg p-4 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">Add Track</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Track title"
              value={addTitle}
              onChange={e => setAddTitle(e.target.value)}
              className="w-full mb-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <input
              type="url"
              placeholder="Paste YouTube or SoundCloud URL"
              value={addUrl}
              onChange={e => setAddUrl(e.target.value)}
              className="w-full mb-3 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={addTrack}
              disabled={!addUrl.trim() || !addTitle.trim()}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-sm font-medium transition-colors"
            >
              Add to Queue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
