/**
 * SharedMediaGallery — Item 106: Per-server gallery of all images/videos
 * Fetches messages with attachments and displays them in a grid.
 */
import { useState, useEffect, useCallback } from 'react';
import { Image, Film, FileText, X, Loader } from 'lucide-react';
import { api, API_BASE } from '../../lib/api';

interface MediaItem {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  messageId: string;
  authorUsername: string;
  createdAt: string;
}

interface Props {
  guildId: string;
  onClose: () => void;
}

export const SharedMediaGallery = ({ guildId, onClose }: Props) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'file'>('all');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  useEffect(() => {
    const hasFilter = filter === 'all' ? 'file' : filter === 'image' ? 'image' : 'file';
    api.search.messages({ query: ' ', limit: 50, has: hasFilter } as any)
      .then((data: any) => {
        const results = data?.results || [];
        const mediaItems: MediaItem[] = [];
        // This is a simplified version — in production you'd have a dedicated media endpoint
        results.forEach((msg: any) => {
          if (msg.attachments) {
            for (const att of msg.attachments) {
              mediaItems.push({
                id: att.id || msg.id,
                url: att.url,
                filename: att.filename,
                mimeType: att.mimeType || '',
                messageId: msg.id,
                authorUsername: msg.authorUsername || 'Unknown',
                createdAt: msg.createdAt,
              });
            }
          }
        });
        setItems(mediaItems);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildId, filter]);

  const filteredItems = items.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'image') return item.mimeType.startsWith('image/');
    if (filter === 'video') return item.mimeType.startsWith('video/');
    return !item.mimeType.startsWith('image/') && !item.mimeType.startsWith('video/');
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-panel" onClick={e => e.stopPropagation()} style={{
        width: 'min(900px, 95vw)', maxHeight: '90vh', borderRadius: '12px',
        border: '1px solid var(--stroke)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--stroke)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Server Media Gallery</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Close"><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', gap: '8px', padding: '12px 24px', borderBottom: '1px solid var(--stroke)' }}>
          {(['all', 'image', 'video', 'file'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: '20px', border: 'none', fontSize: '12px', fontWeight: 600,
              background: filter === f ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: filter === f ? '#000' : 'var(--text-secondary)', cursor: 'pointer', textTransform: 'capitalize',
            }}>
              {f === 'all' ? 'All' : f === 'image' ? 'Images' : f === 'video' ? 'Videos' : 'Files'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}><Loader size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>No media found.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
              {filteredItems.map(item => (
                <div key={item.id} onClick={() => setSelectedItem(item)} style={{
                  aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.mimeType.startsWith('image/') ? (
                    <img src={item.url} alt={item.filename} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : item.mimeType.startsWith('video/') ? (
                    <Film size={32} color="var(--text-muted)" />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '8px' }}>
                      <FileText size={24} color="var(--text-muted)" />
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.filename}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedItem && (
          <div className="modal-overlay" onClick={() => setSelectedItem(null)} style={{ zIndex: 1000 }}>
            <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
              {selectedItem.mimeType.startsWith('image/') ? (
                <img src={selectedItem.url} alt={selectedItem.filename} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px' }} />
              ) : selectedItem.mimeType.startsWith('video/') ? (
                <video src={selectedItem.url} controls autoPlay style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px' }} />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedMediaGallery;
