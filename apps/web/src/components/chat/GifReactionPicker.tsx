import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Loader } from 'lucide-react';

interface GifReactionPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

interface GifResult {
  id: string;
  url: string;
  previewUrl: string;
  title: string;
}

// Tenor API v2 (free tier)
const TENOR_API_KEY = 'AIzaSyDZdyMgGMo9y7PY6Hj3DPlz_TgH0E-I3iQ'; // public demo key
const TENOR_BASE = 'https://tenor.googleapis.com/v2';

export function GifReactionPicker({ onSelect, onClose }: GifReactionPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GifResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [trending, setTrending] = useState<GifResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Load trending on mount
    setIsLoading(true);
    fetch(`${TENOR_BASE}/featured?key=${TENOR_API_KEY}&limit=20&media_filter=gif,tinygif`)
      .then(r => r.json())
      .then(data => {
        if (data.results) {
          setTrending(data.results.map((r: any) => ({
            id: r.id,
            url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || '',
            previewUrl: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || '',
            title: r.content_description || '',
          })));
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const searchGifs = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    fetch(`${TENOR_BASE}/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(searchQuery)}&limit=20&media_filter=gif,tinygif`)
      .then(r => r.json())
      .then(data => {
        if (data.results) {
          setResults(data.results.map((r: any) => ({
            id: r.id,
            url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || '',
            previewUrl: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || '',
            title: r.content_description || '',
          })));
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchGifs(value), 400);
  };

  const displayGifs = query.trim() ? results : trending;

  return (
    <div style={{
      width: '340px', maxHeight: '420px',
      background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
      borderRadius: '12px', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '12px', borderBottom: '1px solid var(--stroke)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', flex: 1,
          background: 'var(--bg-tertiary)', borderRadius: '8px',
          padding: '6px 10px', border: '1px solid var(--stroke)',
        }}>
          <Search size={14} color="var(--text-muted)" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleInputChange(e.target.value)}
            placeholder="Search GIFs..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: '13px',
            }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 0, display: 'flex',
            }}>
              <X size={12} />
            </button>
          )}
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', padding: '4px',
        }}>
          <X size={16} />
        </button>
      </div>

      {/* Label */}
      <div style={{
        padding: '8px 12px 4px', fontSize: '11px', fontWeight: 600,
        color: 'var(--text-muted)', textTransform: 'uppercase',
      }}>
        {query.trim() ? 'Search Results' : 'Trending GIFs'}
      </div>

      {/* Grid */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '4px 8px 8px',
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '6px', alignContent: 'start',
      }}>
        {isLoading ? (
          <div style={{
            gridColumn: 'span 2', display: 'flex', justifyContent: 'center',
            padding: '24px', color: 'var(--text-muted)',
          }}>
            <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : displayGifs.length === 0 ? (
          <div style={{
            gridColumn: 'span 2', textAlign: 'center', padding: '24px',
            color: 'var(--text-muted)', fontSize: '13px',
          }}>
            {query.trim() ? 'No GIFs found' : 'Loading...'}
          </div>
        ) : (
          displayGifs.map(gif => (
            <button
              key={gif.id}
              onClick={() => onSelect(gif.url)}
              title={gif.title}
              style={{
                background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                borderRadius: '8px', overflow: 'hidden', cursor: 'pointer',
                padding: 0, aspectRatio: '1', position: 'relative',
              }}
            >
              <img
                src={gif.previewUrl}
                alt={gif.title}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </button>
          ))
        )}
      </div>

      {/* Tenor attribution */}
      <div style={{
        padding: '6px 12px', borderTop: '1px solid var(--stroke)',
        fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center',
      }}>
        Powered by Tenor
      </div>
    </div>
  );
}
