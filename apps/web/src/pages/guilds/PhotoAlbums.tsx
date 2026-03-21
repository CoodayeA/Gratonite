import { useState, useEffect, useCallback } from 'react';
import { ImagePlus, ArrowLeft, Plus, Trash2, X, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';

interface Album {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  createdBy: string;
  createdAt: string;
  itemCount: number;
}

interface Photo {
  id: string;
  fileUrl: string;
  caption: string | null;
  addedBy: string;
  createdAt: string;
}

interface AlbumDetail extends Omit<Album, 'itemCount'> {
  photos: Photo[];
}

interface PhotoAlbumsProps {
  guildId: string;
}

export default function PhotoAlbums({ guildId }: PhotoAlbumsProps) {
  const { addToast } = useToast();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeAlbum, setActiveAlbum] = useState<AlbumDetail | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddPhoto, setShowAddPhoto] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');

  const fetchAlbums = useCallback(async () => {
    try {
      const data = await api.photoAlbums.list(guildId);
      setAlbums(data as Album[]);
    } catch {
      addToast({ title: 'Failed to load albums', variant: 'error' });
    }
  }, [guildId, addToast]);

  useEffect(() => { fetchAlbums(); }, [fetchAlbums]);

  const openAlbum = async (albumId: string) => {
    try {
      const data = await api.photoAlbums.get(guildId, albumId);
      setActiveAlbum(data as AlbumDetail);
    } catch {
      addToast({ title: 'Failed to load album', variant: 'error' });
    }
  };

  const createAlbum = async () => {
    if (!newName.trim()) return;
    try {
      const album = await api.photoAlbums.create(guildId, { name: newName, description: newDesc || undefined }) as { id: string };
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      fetchAlbums();
      openAlbum(album.id);
    } catch {
      addToast({ title: 'Failed to create album', variant: 'error' });
    }
  };

  const addPhoto = async () => {
    if (!photoUrl.trim() || !activeAlbum) return;
    try {
      const photo = await api.photoAlbums.addPhoto(guildId, activeAlbum.id, {
        fileUrl: photoUrl,
        caption: photoCaption || undefined,
      }) as Photo;
      setActiveAlbum(prev => prev ? { ...prev, photos: [photo, ...prev.photos] } : null);
      setPhotoUrl('');
      setPhotoCaption('');
      setShowAddPhoto(false);
    } catch {
      addToast({ title: 'Failed to add photo', variant: 'error' });
    }
  };

  const deletePhoto = async (photoId: string) => {
    if (!activeAlbum) return;
    try {
      await api.photoAlbums.removePhoto(guildId, activeAlbum.id, photoId);
      setActiveAlbum(prev => prev ? { ...prev, photos: prev.photos.filter(p => p.id !== photoId) } : null);
    } catch {
      addToast({ title: 'Failed to delete photo', variant: 'error' });
    }
  };

  const deleteAlbum = async (albumId: string) => {
    try {
      await api.photoAlbums.delete(guildId, albumId);
      setActiveAlbum(null);
      fetchAlbums();
    } catch {
      addToast({ title: 'Failed to delete album', variant: 'error' });
    }
  };

  // Lightbox keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null || !activeAlbum) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') setLightboxIndex(i => i !== null ? Math.min(i + 1, activeAlbum.photos.length - 1) : null);
      if (e.key === 'ArrowLeft') setLightboxIndex(i => i !== null ? Math.max(i - 1, 0) : null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIndex, activeAlbum]);

  // Album detail view
  if (activeAlbum) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => setActiveAlbum(null)} style={{ padding: 6, borderRadius: 4, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft style={{ width: 20, height: 20 }} />
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{activeAlbum.name}</h2>
            {activeAlbum.description && <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{activeAlbum.description}</p>}
          </div>
          <button onClick={() => setShowAddPhoto(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'var(--accent)', color: 'white', borderRadius: 4, fontSize: 14, border: 'none', cursor: 'pointer' }}>
            <ImagePlus style={{ width: 16, height: 16 }} /> Add Photo
          </button>
          <button onClick={() => deleteAlbum(activeAlbum.id)} style={{ padding: 6, borderRadius: 4, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Trash2 style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Add Photo Modal */}
        {showAddPhoto && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setShowAddPhoto(false)}>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 16, width: '100%', maxWidth: 448, margin: '0 16px' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Add Photo</h3>
                <button onClick={() => setShowAddPhoto(false)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: 20, height: 20 }} /></button>
              </div>
              <input
                type="url"
                placeholder="Image URL"
                value={photoUrl}
                onChange={e => setPhotoUrl(e.target.value)}
                style={{ width: '100%', marginBottom: 8, padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 14, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
              />
              <input
                type="text"
                placeholder="Caption (optional)"
                value={photoCaption}
                onChange={e => setPhotoCaption(e.target.value)}
                style={{ width: '100%', marginBottom: 12, padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 14, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
              />
              <button onClick={addPhoto} disabled={!photoUrl.trim()} style={{ width: '100%', padding: '8px 0', background: !photoUrl.trim() ? 'var(--bg-tertiary)' : 'var(--accent)', color: !photoUrl.trim() ? 'var(--text-muted)' : 'white', borderRadius: 4, fontSize: 14, fontWeight: 500, border: 'none', cursor: !photoUrl.trim() ? 'default' : 'pointer' }}>
                Add Photo
              </button>
            </div>
          </div>
        )}

        {/* Photo Grid */}
        {activeAlbum.photos.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
            <ImagePlus style={{ width: 48, height: 48, marginBottom: 8 }} />
            <p style={{ fontSize: 14 }}>No photos yet</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {activeAlbum.photos.map((photo, i) => (
              <div key={photo.id} className="photo-grid-item" style={{ position: 'relative', aspectRatio: '1', cursor: 'pointer' }} onClick={() => setLightboxIndex(i)}>
                <img src={photo.fileUrl} alt={photo.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                <div className="photo-overlay" style={{ position: 'absolute', inset: 0, background: 'transparent', borderRadius: 8, transition: 'background 0.2s' }} />
                {photo.caption && (
                  <div className="photo-caption" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 6, fontSize: 12, color: 'white', background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)', borderRadius: '0 0 8px 8px', opacity: 0, transition: 'opacity 0.2s', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {photo.caption}
                  </div>
                )}
                <button
                  onClick={e => { e.stopPropagation(); deletePhoto(photo.id); }}
                  className="photo-delete-btn"
                  style={{ position: 'absolute', top: 4, right: 4, padding: 4, background: 'rgba(0,0,0,0.5)', borderRadius: 4, color: 'var(--danger)', border: 'none', cursor: 'pointer', opacity: 0, transition: 'opacity 0.2s' }}
                >
                  <Trash2 style={{ width: 12, height: 12 }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Lightbox */}
        {lightboxIndex !== null && activeAlbum.photos[lightboxIndex] && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setLightboxIndex(null)}>
            <button onClick={() => setLightboxIndex(null)} style={{ position: 'absolute', top: 16, right: 16, color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X style={{ width: 32, height: 32 }} />
            </button>
            {lightboxIndex > 0 && (
              <button onClick={e => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }} style={{ position: 'absolute', left: 16, padding: 8, color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <ChevronLeft style={{ width: 32, height: 32 }} />
              </button>
            )}
            {lightboxIndex < activeAlbum.photos.length - 1 && (
              <button onClick={e => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }} style={{ position: 'absolute', right: 16, padding: 8, color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <ChevronRight style={{ width: 32, height: 32 }} />
              </button>
            )}
            <div style={{ maxWidth: 896, maxHeight: '85vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
              <img src={activeAlbum.photos[lightboxIndex].fileUrl} alt="" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 4 }} />
              {activeAlbum.photos[lightboxIndex].caption && (
                <p style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary)' }}>{activeAlbum.photos[lightboxIndex].caption}</p>
              )}
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{lightboxIndex + 1} / {activeAlbum.photos.length}</p>
            </div>
          </div>
        )}

        <style>{`
          .photo-grid-item:hover .photo-overlay { background: rgba(0,0,0,0.3) !important; }
          .photo-grid-item:hover .photo-caption { opacity: 1 !important; }
          .photo-grid-item:hover .photo-delete-btn { opacity: 1 !important; }
        `}</style>
      </div>
    );
  }

  // Albums gallery view
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Photo Albums</h2>
        <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'var(--accent)', color: 'white', borderRadius: 4, fontSize: 14, border: 'none', cursor: 'pointer' }}>
          <Plus style={{ width: 16, height: 16 }} /> Create Album
        </button>
      </div>

      {/* Create Album Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setShowCreate(false)}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 16, width: '100%', maxWidth: 448, margin: '0 16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Create Album</h3>
              <button onClick={() => setShowCreate(false)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: 20, height: 20 }} /></button>
            </div>
            <input
              type="text"
              placeholder="Album name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{ width: '100%', marginBottom: 8, padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 14, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              style={{ width: '100%', marginBottom: 12, padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 14, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
            />
            <button onClick={createAlbum} disabled={!newName.trim()} style={{ width: '100%', padding: '8px 0', background: !newName.trim() ? 'var(--bg-tertiary)' : 'var(--accent)', color: !newName.trim() ? 'var(--text-muted)' : 'white', borderRadius: 4, fontSize: 14, fontWeight: 500, border: 'none', cursor: !newName.trim() ? 'default' : 'pointer' }}>
              Create Album
            </button>
          </div>
        </div>
      )}

      {albums.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <ImagePlus style={{ width: 48, height: 48, marginBottom: 8 }} />
          <p style={{ fontSize: 14 }}>No albums yet. Create one to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {albums.map(album => (
            <button
              key={album.id}
              onClick={() => openAlbum(album.id)}
              style={{ background: 'var(--bg-secondary)', borderRadius: 8, overflow: 'hidden', textAlign: 'left', transition: 'background 0.2s', border: 'none', cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
            >
              <div style={{ aspectRatio: '16/9', background: 'var(--bg-tertiary)', position: 'relative' }}>
                {album.coverUrl ? (
                  <img src={album.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ImagePlus style={{ width: 32, height: 32, color: 'var(--text-muted)' }} />
                  </div>
                )}
              </div>
              <div style={{ padding: 8 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{album.itemCount} photo{album.itemCount !== 1 ? 's' : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
