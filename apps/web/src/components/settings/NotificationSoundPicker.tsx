import { useState, useRef, useCallback } from 'react';
import { Volume2, Upload, Check, Play, Square, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationSoundPickerProps {
  eventType: string;
  currentSoundId?: string;
  guildId?: string;
  onChange: (soundId: string | null) => void;
}

interface SoundOption {
  id: string;
  name: string;
  category: 'builtin' | 'custom';
  url?: string;
}

const BUILTIN_SOUNDS: SoundOption[] = [
  { id: 'chime', name: 'Chime', category: 'builtin' },
  { id: 'ping', name: 'Ping', category: 'builtin' },
  { id: 'pop', name: 'Pop', category: 'builtin' },
  { id: 'bell', name: 'Bell', category: 'builtin' },
  { id: 'drop', name: 'Drop', category: 'builtin' },
  { id: 'whoosh', name: 'Whoosh', category: 'builtin' },
  { id: 'click', name: 'Click', category: 'builtin' },
  { id: 'ding', name: 'Ding', category: 'builtin' },
  { id: 'bubble', name: 'Bubble', category: 'builtin' },
  { id: 'swish', name: 'Swish', category: 'builtin' },
];

const MAX_FILE_SIZE = 500 * 1024; // 500KB
const MAX_DURATION = 5; // 5 seconds
const ACCEPTED_TYPES = ['.mp3', '.wav', '.ogg'];

export function NotificationSoundPicker({ eventType, currentSoundId, guildId, onChange }: NotificationSoundPickerProps) {
  const [open, setOpen] = useState(false);
  const [customSounds, setCustomSounds] = useState<SoundOption[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSound = currentSoundId
    ? [...BUILTIN_SOUNDS, ...customSounds].find((s) => s.id === currentSoundId)
    : null;

  const playPreview = useCallback((sound: SoundOption) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingId === sound.id) {
      setPlayingId(null);
      return;
    }
    const url = sound.url || `/sounds/notifications/${sound.id}.mp3`;
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingId(sound.id);
    audio.play().catch(() => {});
    audio.onended = () => { setPlayingId(null); audioRef.current = null; };
  }, [playingId]);

  const handleSelect = useCallback((soundId: string | null) => {
    onChange(soundId);
    setOpen(false);
  }, [onChange]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File must be under 500KB');
      return;
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext)) {
      setUploadError('Only .mp3, .wav, .ogg accepted');
      return;
    }

    // Check duration
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      if (audio.duration > MAX_DURATION) {
        setUploadError('Sound must be 5 seconds or shorter');
        URL.revokeObjectURL(url);
        return;
      }
      const newSound: SoundOption = {
        id: `custom-${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        category: 'custom',
        url,
      };
      setCustomSounds((prev) => [...prev, newSound]);
      handleSelect(newSound.id);
    };
    audio.onerror = () => {
      setUploadError('Could not read audio file');
      URL.revokeObjectURL(url);
    };

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleSelect]);

  const renderSoundRow = (sound: SoundOption) => {
    const isSelected = currentSoundId === sound.id;
    const isPlaying = playingId === sound.id;
    return (
      <div
        key={sound.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          borderRadius: '6px',
          cursor: 'pointer',
          background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
          transition: 'background 0.12s',
        }}
        className={!isSelected ? 'hover-bg-secondary' : ''}
        onClick={() => handleSelect(sound.id)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); playPreview(sound); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: 'none',
            background: isPlaying ? 'var(--accent-primary)' : 'var(--bg-secondary)',
            color: isPlaying ? '#fff' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
          }}
        >
          {isPlaying ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
        </button>
        <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)' }}>{sound.name}</span>
        {isSelected && <Check size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}
      </div>
    );
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--stroke)',
          borderRadius: '8px',
          padding: '8px 12px',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontSize: '13px',
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Volume2 size={14} style={{ color: 'var(--accent-primary)' }} />
          <span>{currentSound ? currentSound.name : 'Default'}</span>
        </div>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--stroke)',
              borderRadius: '10px',
              padding: '6px',
              zIndex: 50,
              maxHeight: '360px',
              overflowY: 'auto',
            }}
          >
            {/* Default */}
            <div
              onClick={() => handleSelect(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                background: !currentSoundId ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              }}
              className={currentSoundId ? 'hover-bg-secondary' : ''}
            >
              <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Volume2 size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
              <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)' }}>Default</span>
              {!currentSoundId && <Check size={14} style={{ color: 'var(--accent-primary)' }} />}
            </div>

            <div style={{ height: '1px', background: 'var(--stroke)', margin: '4px 10px' }} />

            {/* Built-in */}
            <div style={{ padding: '4px 10px 2px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Built-in Sounds
            </div>
            {BUILTIN_SOUNDS.map(renderSoundRow)}

            {/* Custom */}
            {customSounds.length > 0 && (
              <>
                <div style={{ height: '1px', background: 'var(--stroke)', margin: '4px 10px' }} />
                <div style={{ padding: '4px 10px 2px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Custom Sounds
                </div>
                {customSounds.map(renderSoundRow)}
              </>
            )}

            <div style={{ height: '1px', background: 'var(--stroke)', margin: '4px 10px' }} />

            {/* Upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--accent-primary)',
              }}
              className="hover-bg-secondary"
            >
              <Upload size={14} />
              Upload Custom Sound
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.ogg"
              style={{ display: 'none' }}
              onChange={handleUpload}
            />

            {uploadError && (
              <div style={{ padding: '4px 10px', fontSize: '11px', color: '#ef4444' }}>{uploadError}</div>
            )}

            <div style={{ padding: '2px 10px 4px', fontSize: '10px', color: 'var(--text-muted)' }}>
              .mp3, .wav, .ogg - max 500KB, 5s
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
