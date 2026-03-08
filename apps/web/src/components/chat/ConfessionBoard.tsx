import { useState, useEffect, useRef } from 'react';
import { EyeOff, Send, Shield, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '../ui/ToastManager';
import { api } from '../../lib/api';

type Confession = {
  id: string;
  channelId: string;
  guildId: string;
  anonLabel: string;
  content: string;
  createdAt: string;
};

const ConfessionBoard = ({ channelId, guildId, isOwnerOrAdmin }: { channelId: string; guildId: string; isOwnerOrAdmin?: boolean }) => {
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [revealConfirm, setRevealConfirm] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  useEffect(() => { loadConfessions(); }, [channelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [confessions]);

  const loadConfessions = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/channels/${channelId}/confessions`) as Confession[];
      setConfessions([...res].reverse());
    } catch { addToast({ title: 'Failed to load confessions', variant: 'error' }); }
    setLoading(false);
  };

  const postConfession = async () => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/channels/${channelId}/confessions`, { content: content.trim() }) as Confession;
      setConfessions(prev => [...prev, res]);
      setContent('');
    } catch { addToast({ title: 'Failed to post confession', variant: 'error' }); }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      postConfession();
    }
  };

  const revealAuthor = async (confessionId: string) => {
    try {
      const res = await api.post(`/guilds/${guildId}/confessions/${confessionId}/reveal`, {}) as { authorId: string };
      addToast({ title: `Author revealed: ${res.authorId}`, variant: 'info' });
      setRevealConfirm(null);
    } catch { addToast({ title: 'Failed to reveal author', variant: 'error' }); }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
        <EyeOff size={16} className="text-purple-400" />
        <span className="text-sm font-semibold text-white">Confession Board</span>
        <span className="text-xs text-gray-500">Posts are anonymous</span>
      </div>

      {/* Confessions list */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading confessions...</div>
        ) : confessions.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <EyeOff size={32} className="mx-auto mb-2 opacity-50" />
            <p>No confessions yet. Be the first!</p>
          </div>
        ) : (
          confessions.map(c => (
            <div key={c.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-start gap-3">
                {/* Anonymous avatar */}
                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                  <EyeOff size={14} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-300">{c.anonLabel}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock size={10} /> {formatTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{c.content}</p>
                </div>
                {/* Admin reveal */}
                {isOwnerOrAdmin && (
                  <div className="relative flex-shrink-0">
                    {revealConfirm === c.id ? (
                      <div className="bg-gray-900 rounded-lg p-3 border border-gray-600 absolute right-0 top-0 w-56 z-10">
                        <div className="flex items-center gap-1 text-xs text-yellow-400 mb-2">
                          <AlertTriangle size={12} /> Reveal anonymous author?
                        </div>
                        <p className="text-xs text-gray-400 mb-2">This action will be logged in the audit log.</p>
                        <div className="flex gap-2">
                          <button onClick={() => revealAuthor(c.id)}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors">
                            Reveal
                          </button>
                          <button onClick={() => setRevealConfirm(null)}
                            className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setRevealConfirm(c.id)}
                        className="p-1 text-gray-600 hover:text-yellow-400 transition-colors" title="Reveal Author">
                        <Shield size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Anonymous input */}
      <div className="px-4 py-3 border-t border-gray-700">
        <div className="bg-gray-800 rounded-lg border border-gray-700 flex items-end">
          <div className="px-3 py-2">
            <EyeOff size={16} className="text-purple-400" />
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Post anonymously..."
            rows={1}
            className="flex-1 bg-transparent text-white text-sm py-2 resize-none outline-none placeholder-gray-500 max-h-32"
          />
          <button onClick={postConfession} disabled={!content.trim() || sending}
            className="px-3 py-2 text-purple-400 hover:text-purple-300 disabled:text-gray-600 transition-colors">
            <Send size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-1 text-center">Your identity is hidden from other members</p>
      </div>
    </div>
  );
};

export default ConfessionBoard;
