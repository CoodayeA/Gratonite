import { useState, useEffect } from 'react';
import { Pin, ChevronUp, ChevronDown, X } from 'lucide-react';
import { api } from '../../lib/api';

interface StickyMessageProps {
  channelId: string;
  guildId?: string;
  canManage?: boolean;
}

interface StickyData {
  channelId: string;
  content: string;
  setBy: string;
  setAt: string;
  setByUsername?: string;
  setByDisplayName?: string;
}

export default function StickyMessage({ channelId, guildId, canManage }: StickyMessageProps) {
  const [sticky, setSticky] = useState<StickyData | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
    setCollapsed(false);
    loadSticky();
  }, [channelId]);

  async function loadSticky() {
    try {
      const res = await api.get(`/channels/${channelId}/sticky`) as StickyData | null;
      setSticky(res);
    } catch {
      setSticky(null);
    }
  }

  async function handleRemove() {
    try {
      await api.delete(`/channels/${channelId}/sticky${guildId ? `?guildId=${guildId}` : ''}`);
      setSticky(null);
    } catch { /* ignore */ }
  }

  if (!sticky || dismissed) return null;

  return (
    <div className="border-b border-gray-700 bg-gray-800/80 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Pin className="w-4 h-4 text-yellow-500 shrink-0" />
          <span className="text-yellow-500 font-medium text-xs">STICKY</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-gray-400 hover:text-gray-200"
          >
            {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
          {canManage ? (
            <button onClick={handleRemove} className="p-1 text-gray-400 hover:text-red-400">
              <X className="w-3 h-3" />
            </button>
          ) : (
            <button onClick={() => setDismissed(true)} className="p-1 text-gray-400 hover:text-gray-200">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className="mt-1">
          <p className="text-sm text-gray-200">{sticky.content}</p>
          <p className="text-xs text-gray-500 mt-1">
            Set by {sticky.setByDisplayName || sticky.setByUsername || 'Unknown'}{' '}
            {sticky.setAt && <>on {new Date(sticky.setAt).toLocaleDateString()}</>}
          </p>
        </div>
      )}
    </div>
  );
}
