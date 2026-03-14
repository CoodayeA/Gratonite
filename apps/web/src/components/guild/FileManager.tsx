/**
 * 111. File Manager — Browse and search shared files per server.
 */
import { useState, useEffect, useCallback } from 'react';
import { Search, FileText, Image, Film, Music, File, Download, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';

interface SharedFile {
  messageId: string;
  channelId: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  image: <Image className="w-5 h-5 text-green-400" />,
  video: <Film className="w-5 h-5 text-purple-400" />,
  audio: <Music className="w-5 h-5 text-yellow-400" />,
  text: <FileText className="w-5 h-5 text-blue-400" />,
};

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(mimeType: string) {
  const type = mimeType.split('/')[0];
  return ICON_MAP[type] || <File className="w-5 h-5 text-gray-400" />;
}

export default function FileManager({ guildId }: { guildId: string }) {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fileManager.list(guildId, search || undefined);
      setFiles(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [guildId, search]);

  useEffect(() => {
    const timer = setTimeout(fetchFiles, 300);
    return () => clearTimeout(timer);
  }, [fetchFiles]);

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-white font-medium">File Manager</h3>
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full bg-gray-800 text-white text-sm rounded-lg pl-9 pr-3 py-2 border border-gray-700 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : files.length === 0 ? (
        <p className="text-gray-500 text-sm">No files found.</p>
      ) : (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={`${f.messageId}-${i}`} className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg group">
              {getFileIcon(f.mimeType)}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{f.filename}</p>
                <p className="text-xs text-gray-500">{formatSize(f.size)} - {f.uploadedBy} - {new Date(f.createdAt).toLocaleDateString()}</p>
              </div>
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-white">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
