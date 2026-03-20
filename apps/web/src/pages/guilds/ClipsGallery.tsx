import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Film, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { VoiceClipPlayer } from '../../components/voice/VoiceClipPlayer';

interface Clip {
  id: string;
  userId: string;
  guildId: string;
  channelId: string | null;
  title: string;
  fileId: string | null;
  duration: number | null;
  createdAt: string;
  creatorName: string | null;
  url: string | null;
}

export default function ClipsGallery() {
  const { guildId } = useParams<{ guildId: string }>();
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!guildId) return;
    setLoading(true);
    setError(false);
    api.get(`/guilds/${guildId}/clips?limit=50`)
      .then((res: any) => setClips(res.data ?? res))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [guildId]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-muted)', padding: '40px' }}>
        <Film size={48} />
        <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>Failed to Load Clips</h2>
        <p style={{ margin: 0, fontSize: '14px', textAlign: 'center' }}>Something went wrong. Please try again later.</p>
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-muted)', padding: '40px' }}>
        <Film size={48} />
        <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>No Clips Yet</h2>
        <p style={{ margin: 0, fontSize: '14px', textAlign: 'center' }}>Record voice clips in voice channels to see them here.</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Film size={20} /> Clips Gallery
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {clips.map(clip => (
          <div key={clip.id} style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--stroke)' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {clip.title}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              by {clip.creatorName || 'Unknown'} · {clip.duration ? `${Math.floor(clip.duration / 60)}:${String(clip.duration % 60).padStart(2, '0')}` : '—'}
            </div>
            {clip.url ? (
              <VoiceClipPlayer clipUrl={clip.url} title={clip.title} duration={clip.duration ?? 0} author={clip.creatorName ?? 'Unknown'} />
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Audio unavailable</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
