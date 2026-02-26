import { useEffect, useState, useRef, useMemo, useCallback, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TopBar } from '@/components/layout/TopBar';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { playSoundboardClip, stopSoundboardPlayback } from '@/lib/soundboard';
import { useGuildsStore } from '@/stores/guilds.store';

interface SoundboardSound {
  id: string;
  guildId: string;
  name: string;
  soundHash: string;
  volume: number;
  emojiId?: string | null;
  emojiName?: string | null;
  uploaderId: string;
  available: boolean;
}

export function SoundboardPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const guild = useGuildsStore((s) => (guildId ? s.guilds.get(guildId) : undefined));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Add new sound form
  const [newSoundName, setNewSoundName] = useState('');
  const [newSoundFile, setNewSoundFile] = useState<File | null>(null);
  const [newSoundVolume, setNewSoundVolume] = useState(80);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: sounds = [], isLoading } = useQuery({
    queryKey: ['soundboard', guildId],
    queryFn: () => (guildId ? api.voice.getSoundboard(guildId) : Promise.resolve([])),
    enabled: Boolean(guildId),
  });

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(''), 2500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const filteredSounds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sounds;
    return sounds.filter((s) => s.name.toLowerCase().includes(q));
  }, [sounds, search]);

  const handlePlaySound = useCallback((sound: SoundboardSound) => {
    if (playingId === sound.id) {
      stopSoundboardPlayback();
      setPlayingId(null);
      return;
    }
    setPlayingId(sound.id);
    playSoundboardClip({ soundHash: sound.soundHash, volume: sound.volume });
    // Auto-clear playing state after a reasonable duration
    setTimeout(() => setPlayingId((prev) => (prev === sound.id ? null : prev)), 5000);
  }, [playingId]);

  const handlePlayRemote = useCallback(async (sound: SoundboardSound) => {
    if (!guildId) return;
    try {
      await api.voice.playSoundboard(guildId, sound.id);
      setFeedback(`Playing "${sound.name}" in voice.`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [guildId]);

  async function handleUploadSound(e: FormEvent) {
    e.preventDefault();
    if (!guildId || !newSoundFile || !newSoundName.trim()) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = await api.files.upload(newSoundFile, 'upload');
      await api.voice.createSoundboard(guildId, {
        name: newSoundName.trim(),
        soundHash: uploaded.id,
        volume: newSoundVolume / 100,
      });
      setNewSoundName('');
      setNewSoundFile(null);
      setNewSoundVolume(80);
      setShowAddForm(false);
      await queryClient.invalidateQueries({ queryKey: ['soundboard', guildId] });
      setFeedback('Sound added to soundboard.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteSound(soundId: string) {
    if (!guildId) return;
    if (!window.confirm('Delete this sound from the soundboard?')) return;
    setDeletingId(soundId);
    try {
      await api.voice.deleteSoundboard(guildId, soundId);
      await queryClient.invalidateQueries({ queryKey: ['soundboard', guildId] });
      setFeedback('Sound deleted.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleUpdateVolume(soundId: string, volume: number) {
    if (!guildId) return;
    try {
      await api.voice.updateSoundboard(guildId, soundId, { volume: volume / 100 });
      await queryClient.invalidateQueries({ queryKey: ['soundboard', guildId] });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (!guildId) {
    return (
      <div className="channel-page">
        <div className="channel-empty">
          <div className="channel-empty-title">No portal selected</div>
        </div>
      </div>
    );
  }

  return (
    <div className="channel-page">
      <div className="soundboard-page">
        <div className="soundboard-header">
          <div>
            <h2 className="settings-shell-section-heading">Soundboard</h2>
            <p className="server-settings-muted">
              {guild?.name ? `${guild.name} — ` : ''}Play sounds in voice channels. Upload custom clips for your portal.
            </p>
          </div>
          <div className="server-settings-actions">
            <Button
              variant={showAddForm ? 'ghost' : 'primary'}
              size="sm"
              onClick={() => setShowAddForm((prev) => !prev)}
            >
              {showAddForm ? 'Cancel' : '+ Add Sound'}
            </Button>
          </div>
        </div>

        {error && <div className="modal-error">{error}</div>}
        {feedback && (
          <div className="server-settings-feedback" role="status" aria-live="polite">
            {feedback}
          </div>
        )}

        {/* Add new sound form */}
        {showAddForm && (
          <form className="channel-permission-card" style={{ marginBottom: 16 }} onSubmit={handleUploadSound}>
            <div className="channel-permission-title">Upload New Sound</div>
            <div className="channel-permission-row" style={{ marginBottom: 8 }}>
              <Input
                label=""
                type="text"
                value={newSoundName}
                onChange={(e) => setNewSoundName(e.target.value)}
                placeholder="Sound name (e.g. airhorn)"
                maxLength={32}
                required
              />
            </div>
            <div className="channel-permission-row" style={{ marginBottom: 8, alignItems: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => setNewSoundFile(e.target.files?.[0] ?? null)}
                style={{ flex: 1 }}
              />
            </div>
            <div className="channel-permission-row" style={{ marginBottom: 8, alignItems: 'center', gap: 12 }}>
              <label className="input-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>
                Volume: {newSoundVolume}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={newSoundVolume}
                onChange={(e) => setNewSoundVolume(Number(e.target.value))}
                style={{ flex: 1 }}
              />
            </div>
            <Button type="submit" loading={uploading} disabled={!newSoundName.trim() || !newSoundFile}>
              Upload Sound
            </Button>
          </form>
        )}

        {/* Search */}
        <div style={{ marginBottom: 12 }}>
          <input
            className="input-field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sounds..."
          />
        </div>

        {/* Stats */}
        <div className="server-settings-inline-stats" style={{ marginBottom: 12 }}>
          <span className="server-settings-stat-pill">{sounds.length} sound{sounds.length === 1 ? '' : 's'}</span>
          {search && (
            <span className="server-settings-stat-pill">{filteredSounds.length} shown</span>
          )}
        </div>

        {/* Sound grid */}
        {isLoading ? (
          <div className="server-settings-muted" style={{ textAlign: 'center', padding: 32 }}>
            Loading sounds...
          </div>
        ) : filteredSounds.length === 0 ? (
          <div className="server-settings-muted" style={{ textAlign: 'center', padding: 32 }}>
            {sounds.length === 0
              ? 'No sounds yet. Add one to get started!'
              : 'No sounds match your search.'}
          </div>
        ) : (
          <div className="soundboard-grid">
            {filteredSounds.map((sound) => {
              const isPlaying = playingId === sound.id;
              const isDeleting = deletingId === sound.id;
              return (
                <div key={sound.id} className={`soundboard-card ${isPlaying ? 'soundboard-card-playing' : ''}`}>
                  <div className="soundboard-card-header">
                    <span className="soundboard-card-emoji">{sound.emojiName || '🔊'}</span>
                    <span className="soundboard-card-name">{sound.name}</span>
                  </div>
                  <div className="soundboard-card-controls">
                    <button
                      type="button"
                      className={`soundboard-play-btn ${isPlaying ? 'soundboard-play-btn-active' : ''}`}
                      onClick={() => handlePlaySound(sound)}
                      title="Preview locally"
                    >
                      {isPlaying ? '⏹' : '▶'}
                    </button>
                    <button
                      type="button"
                      className="soundboard-play-btn"
                      onClick={() => handlePlayRemote(sound)}
                      title="Play in voice channel"
                    >
                      📢
                    </button>
                    <div className="soundboard-volume-row">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(sound.volume * 100)}
                        onChange={(e) => handleUpdateVolume(sound.id, Number(e.target.value))}
                        className="soundboard-volume-slider"
                        title={`Volume: ${Math.round(sound.volume * 100)}%`}
                      />
                    </div>
                    <button
                      type="button"
                      className="channel-permission-remove"
                      onClick={() => handleDeleteSound(sound.id)}
                      disabled={isDeleting}
                      title="Delete sound"
                    >
                      {isDeleting ? '...' : 'X'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
