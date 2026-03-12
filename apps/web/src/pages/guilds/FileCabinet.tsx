import { useState, useEffect } from 'react';
import { File, Image, Film, Music, FileText, Download, Search, FolderOpen } from 'lucide-react';
import { API_BASE, getAccessToken } from '../../lib/api';

interface SharedFile {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  channelName: string;
  uploadedBy: string;
  uploadedAt: string;
}

const FILE_ICONS: Record<string, typeof File> = {
  image: Image,
  video: Film,
  audio: Music,
  text: FileText,
};

function getFileIcon(mimeType: string) {
  const type = mimeType.split('/')[0];
  return FILE_ICONS[type] || File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileCabinet({ guildId }: { guildId: string }) {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    fetch(`${API_BASE}/guilds/${guildId}/files`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setFiles(Array.isArray(data) ? data : []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [guildId]);

  const filtered = files.filter(f => {
    if (search && !f.filename.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'all' && !f.mimeType.startsWith(typeFilter)) return false;
    return true;
  });

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <FolderOpen size={22} style={{ color: 'var(--accent-primary)' }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>File Cabinet</h2>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{files.length} files</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search files..."
            style={{ width: '100%', padding: '8px 8px 8px 30px', borderRadius: 6, border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13 }}
          />
        </div>
        {['all', 'image', 'video', 'audio', 'application'].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{ padding: '6px 14px', borderRadius: 14, border: 'none', background: typeFilter === t ? 'var(--accent-primary)' : 'var(--bg-elevated)', color: typeFilter === t ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 500, textTransform: 'capitalize' }}>
            {t === 'all' ? 'All' : t === 'application' ? 'Docs' : t + 's'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton-pulse" style={{ height: 56, borderRadius: 6 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <FolderOpen size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>{search || typeFilter !== 'all' ? 'No matching files' : 'No files shared yet'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map(file => {
            const Icon = getFileIcon(file.mimeType);
            return (
              <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
                <Icon size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.filename}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatSize(file.size)} · #{file.channelName} · {file.uploadedBy}
                  </div>
                </div>
                <a href={file.url} download style={{ color: 'var(--text-muted)', padding: 4 }} title="Download">
                  <Download size={16} />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
