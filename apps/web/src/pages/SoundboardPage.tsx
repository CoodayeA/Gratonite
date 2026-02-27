import React, { useEffect, useState, useRef, useMemo, useCallback, type FormEvent } from 'react';
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  channelPage: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
  } as React.CSSProperties,

  channelEmpty: {
    padding: '10px 10px 6px',
    color: 'var(--text-faint)',
    fontSize: 12,
  } as React.CSSProperties,

  channelEmptyTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  page: {
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

  sectionHeading: {
    fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 4,
  } as React.CSSProperties,

  muted: {
    fontSize: 13,
    color: 'var(--text-muted)',
  } as React.CSSProperties,

  actions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  } as React.CSSProperties,

  modalError: {
    padding: '10px 14px',
    background: 'var(--danger-bg)',
    border: '1px solid rgba(255, 107, 107, 0.25)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger)',
    fontSize: 13,
  } as React.CSSProperties,

  feedback: {
    fontSize: 12,
    color: 'var(--text-muted)',
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 10,
    background: 'rgba(255, 255, 255, 0.02)',
    padding: '6px 8px',
    lineHeight: 1.35,
  } as React.CSSProperties,

  permCard: {
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(10, 16, 28, 0.66)',
    padding: 10,
    display: 'grid',
    gap: 8,
    marginBottom: 16,
  } as React.CSSProperties,

  permTitle: {
    fontSize: 12,
    color: 'var(--text-muted)',
  } as React.CSSProperties,

  permRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 8,
    minWidth: 0,
    marginBottom: 8,
  } as React.CSSProperties,

  inputField: {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: 14,
    outline: 'none',
  } as React.CSSProperties,

  inputLabel: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-muted)',
    marginBottom: 0,
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  inlineStats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  } as React.CSSProperties,

  statPill: {
    fontSize: 11,
    color: 'var(--text-muted)',
    border: '1px solid var(--stroke)',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 'var(--radius-pill)',
    padding: '4px 8px',
  } as React.CSSProperties,

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 12,
  } as React.CSSProperties,

  card: {
    background: 'var(--bg-elevated)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--stroke)',
    borderRadius: 10,
    padding: 14,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  } as React.CSSProperties,

  cardPlaying: {
    borderColor: 'var(--accent)',
    boxShadow: '0 0 12px rgba(212, 175, 55, 0.2)',
  } as React.CSSProperties,

  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  } as React.CSSProperties,

  cardEmoji: {
    fontSize: 20,
  } as React.CSSProperties,

  cardName: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  cardControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  } as React.CSSProperties,

  playBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'var(--bg-input, #25243a)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--stroke)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    padding: 0,
    lineHeight: 1,
    transition: 'opacity 0.15s, background 0.15s, border-color 0.15s',
  } as React.CSSProperties,

  playBtnActive: {
    background: 'var(--accent)',
    color: 'var(--bg)',
    borderColor: 'var(--accent)',
  } as React.CSSProperties,

  volumeRow: {
    flex: 1,
    minWidth: 60,
  } as React.CSSProperties,

  volumeSlider: {
    width: '100%',
    accentColor: 'var(--accent)',
    cursor: 'pointer',
  } as React.CSSProperties,

  removeBtn: {
    border: '1px solid var(--stroke)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '4px 8px',
    fontSize: 12,
    flexShrink: 0,
    cursor: 'pointer',
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SoundboardPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const guild = useGuildsStore((st) => (guildId ? st.guilds.get(guildId) : undefined));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const [newSoundName, setNewSoundName] = useState('');
  const [newSoundFile, setNewSoundFile] = useState<File | null>(null);
  const [newSoundVolume, setNewSoundVolume] = useState(80);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [hoveredPlayBtn, setHoveredPlayBtn] = useState<string | null>(null);

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
    return sounds.filter((snd) => snd.name.toLowerCase().includes(q));
  }, [sounds, search]);

  const handlePlaySound = useCallback((sound: SoundboardSound) => {
    if (playingId === sound.id) {
      stopSoundboardPlayback();
      setPlayingId(null);
      return;
    }
    setPlayingId(sound.id);
    playSoundboardClip({ soundHash: sound.soundHash, volume: sound.volume });
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
      <div style={s.channelPage}>
        <div style={s.channelEmpty}>
          <div style={s.channelEmptyTitle}>No portal selected</div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.channelPage}>
      <div style={s.page}>
        <div style={s.header}>
          <div>
            <h2 style={s.sectionHeading}>Soundboard</h2>
            <p style={s.muted}>
              {guild?.name ? `${guild.name} — ` : ''}Play sounds in voice channels. Upload custom clips for your portal.
            </p>
          </div>
          <div style={s.actions}>
            <Button
              variant={showAddForm ? 'ghost' : 'primary'}
              size="sm"
              onClick={() => setShowAddForm((prev) => !prev)}
            >
              {showAddForm ? 'Cancel' : '+ Add Sound'}
            </Button>
          </div>
        </div>

        {error && <div style={s.modalError}>{error}</div>}
        {feedback && (
          <div style={s.feedback} role="status" aria-live="polite">
            {feedback}
          </div>
        )}

        {showAddForm && (
          <form style={s.permCard} onSubmit={handleUploadSound}>
            <div style={s.permTitle}>Upload New Sound</div>
            <div style={s.permRow}>
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
            <div style={{ ...s.permRow, alignItems: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => setNewSoundFile(e.target.files?.[0] ?? null)}
                style={{ flex: 1 }}
              />
            </div>
            <div style={{ ...s.permRow, alignItems: 'center', gap: 12 }}>
              <label style={s.inputLabel}>
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
            style={s.inputField}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sounds..."
          />
        </div>

        {/* Stats */}
        <div style={s.inlineStats}>
          <span style={s.statPill}>{sounds.length} sound{sounds.length === 1 ? '' : 's'}</span>
          {search && (
            <span style={s.statPill}>{filteredSounds.length} shown</span>
          )}
        </div>

        {/* Sound grid */}
        {isLoading ? (
          <div style={{ ...s.muted, textAlign: 'center', padding: 32 }}>
            Loading sounds...
          </div>
        ) : filteredSounds.length === 0 ? (
          <div style={{ ...s.muted, textAlign: 'center', padding: 32 }}>
            {sounds.length === 0
              ? 'No sounds yet. Add one to get started!'
              : 'No sounds match your search.'}
          </div>
        ) : (
          <div style={s.grid}>
            {filteredSounds.map((sound) => {
              const isPlaying = playingId === sound.id;
              const isDeleting = deletingId === sound.id;
              return (
                <div
                  key={sound.id}
                  style={{ ...s.card, ...(isPlaying ? s.cardPlaying : {}) }}
                >
                  <div style={s.cardHeader}>
                    <span style={s.cardEmoji}>{sound.emojiName || '\u{1F50A}'}</span>
                    <span style={s.cardName}>{sound.name}</span>
                  </div>
                  <div style={s.cardControls}>
                    <button
                      type="button"
                      style={{
                        ...s.playBtn,
                        ...(isPlaying ? s.playBtnActive : {}),
                        ...(hoveredPlayBtn === `preview-${sound.id}`
                          ? { background: 'var(--accent)', color: 'var(--bg)', borderColor: 'var(--accent)' }
                          : {}),
                      }}
                      onClick={() => handlePlaySound(sound)}
                      onMouseEnter={() => setHoveredPlayBtn(`preview-${sound.id}`)}
                      onMouseLeave={() => setHoveredPlayBtn(null)}
                      title="Preview locally"
                    >
                      {isPlaying ? '\u23F9' : '\u25B6'}
                    </button>
                    <button
                      type="button"
                      style={{
                        ...s.playBtn,
                        ...(hoveredPlayBtn === `remote-${sound.id}`
                          ? { background: 'var(--accent)', color: 'var(--bg)', borderColor: 'var(--accent)' }
                          : {}),
                      }}
                      onClick={() => handlePlayRemote(sound)}
                      onMouseEnter={() => setHoveredPlayBtn(`remote-${sound.id}`)}
                      onMouseLeave={() => setHoveredPlayBtn(null)}
                      title="Play in voice channel"
                    >
                      {'\u{1F4E2}'}
                    </button>
                    <div style={s.volumeRow}>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(sound.volume * 100)}
                        onChange={(e) => handleUpdateVolume(sound.id, Number(e.target.value))}
                        style={s.volumeSlider}
                        title={`Volume: ${Math.round(sound.volume * 100)}%`}
                      />
                    </div>
                    <button
                      type="button"
                      style={s.removeBtn}
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
