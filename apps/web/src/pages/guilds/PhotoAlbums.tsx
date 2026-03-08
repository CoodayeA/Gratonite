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
      const album = await api.photoAlbums.create(guildId, { name: newName, description: newDesc || undefined }) as any;
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
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setActiveAlbum(null)} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">{activeAlbum.name}</h2>
            {activeAlbum.description && <p className="text-sm text-gray-400">{activeAlbum.description}</p>}
          </div>
          <button onClick={() => setShowAddPhoto(true)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm">
            <ImagePlus className="w-4 h-4" /> Add Photo
          </button>
          <button onClick={() => deleteAlbum(activeAlbum.id)} className="p-1.5 hover:bg-red-600/20 rounded text-red-400 hover:text-red-300">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Add Photo Modal */}
        {showAddPhoto && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddPhoto(false)}>
            <div className="bg-gray-800 rounded-lg p-4 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium">Add Photo</h3>
                <button onClick={() => setShowAddPhoto(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <input
                type="url"
                placeholder="Image URL"
                value={photoUrl}
                onChange={e => setPhotoUrl(e.target.value)}
                className="w-full mb-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder="Caption (optional)"
                value={photoCaption}
                onChange={e => setPhotoCaption(e.target.value)}
                className="w-full mb-3 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
              <button onClick={addPhoto} disabled={!photoUrl.trim()} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-sm font-medium">
                Add Photo
              </button>
            </div>
          </div>
        )}

        {/* Photo Grid */}
        {activeAlbum.photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <ImagePlus className="w-12 h-12 mb-2" />
            <p className="text-sm">No photos yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {activeAlbum.photos.map((photo, i) => (
              <div key={photo.id} className="relative aspect-square group cursor-pointer" onClick={() => setLightboxIndex(i)}>
                <img src={photo.fileUrl} alt={photo.caption || ''} className="w-full h-full object-cover rounded-lg" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg" />
                {photo.caption && (
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 text-xs text-white bg-gradient-to-t from-black/60 to-transparent rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity truncate">
                    {photo.caption}
                  </div>
                )}
                <button
                  onClick={e => { e.stopPropagation(); deletePhoto(photo.id); }}
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Lightbox */}
        {lightboxIndex !== null && activeAlbum.photos[lightboxIndex] && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={() => setLightboxIndex(null)}>
            <button onClick={() => setLightboxIndex(null)} className="absolute top-4 right-4 text-white/70 hover:text-white">
              <X className="w-8 h-8" />
            </button>
            {lightboxIndex > 0 && (
              <button onClick={e => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }} className="absolute left-4 p-2 text-white/70 hover:text-white">
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}
            {lightboxIndex < activeAlbum.photos.length - 1 && (
              <button onClick={e => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }} className="absolute right-4 p-2 text-white/70 hover:text-white">
                <ChevronRight className="w-8 h-8" />
              </button>
            )}
            <div className="max-w-4xl max-h-[85vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
              <img src={activeAlbum.photos[lightboxIndex].fileUrl} alt="" className="max-w-full max-h-[80vh] object-contain rounded" />
              {activeAlbum.photos[lightboxIndex].caption && (
                <p className="mt-2 text-sm text-gray-300">{activeAlbum.photos[lightboxIndex].caption}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">{lightboxIndex + 1} / {activeAlbum.photos.length}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Albums gallery view
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Photo Albums</h2>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm">
          <Plus className="w-4 h-4" /> Create Album
        </button>
      </div>

      {/* Create Album Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-gray-800 rounded-lg p-4 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">Create Album</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <input
              type="text"
              placeholder="Album name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full mb-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="w-full mb-3 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <button onClick={createAlbum} disabled={!newName.trim()} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-sm font-medium">
              Create Album
            </button>
          </div>
        </div>
      )}

      {albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <ImagePlus className="w-12 h-12 mb-2" />
          <p className="text-sm">No albums yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {albums.map(album => (
            <button
              key={album.id}
              onClick={() => openAlbum(album.id)}
              className="bg-gray-800 hover:bg-gray-700 rounded-lg overflow-hidden text-left transition-colors group"
            >
              <div className="aspect-video bg-gray-700 relative">
                {album.coverUrl ? (
                  <img src={album.coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImagePlus className="w-8 h-8 text-gray-600" />
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="text-sm font-medium text-white truncate">{album.name}</p>
                <p className="text-xs text-gray-500">{album.itemCount} photo{album.itemCount !== 1 ? 's' : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
