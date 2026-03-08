import { useState, useEffect, useRef } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface TextReactionGroup {
  text: string;
  count: number;
  users: Array<{ id: string; username: string; displayName: string }>;
}

interface PopularReaction {
  text: string;
  useCount: number;
}

interface TextReactionProps {
  messageId: string;
  channelId: string;
  guildId?: string;
  currentUserId: string;
}

export default function TextReaction({ messageId, channelId, guildId, currentUserId }: TextReactionProps) {
  const { addToast } = useToast();
  const [reactions, setReactions] = useState<TextReactionGroup[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [inputText, setInputText] = useState('');
  const [popular, setPopular] = useState<PopularReaction[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadReactions();
  }, [messageId]);

  useEffect(() => {
    if (showInput && guildId) loadPopular();
  }, [showInput, guildId]);

  useEffect(() => {
    if (showInput && inputRef.current) inputRef.current.focus();
  }, [showInput]);

  async function loadReactions() {
    try {
      const data = await api.get<TextReactionGroup[]>(`/channels/${channelId}/messages/${messageId}/text-reactions`);
      setReactions(data);
    } catch { /* ignore */ }
  }

  async function loadPopular() {
    if (!guildId) return;
    try {
      const data = await api.get<PopularReaction[]>(`/guilds/${guildId}/text-reactions/popular`);
      setPopular(data);
    } catch { /* ignore */ }
  }

  async function addReaction(text: string) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 20) return;
    try {
      await api.post(`/channels/${channelId}/messages/${messageId}/text-reactions`, { text: trimmed });
      setInputText('');
      setShowInput(false);
      loadReactions();
    } catch {
      addToast({ title: 'Failed to add reaction', variant: 'error' });
    }
  }

  async function removeReaction(text: string) {
    try {
      await api.delete(`/channels/${channelId}/messages/${messageId}/text-reactions/${encodeURIComponent(text)}`);
      loadReactions();
    } catch {
      addToast({ title: 'Failed to remove reaction', variant: 'error' });
    }
  }

  function handleReactionClick(group: TextReactionGroup) {
    const isMine = group.users.some(u => u.id === currentUserId);
    if (isMine) {
      removeReaction(group.text);
    } else {
      addReaction(group.text);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {reactions.map((group) => {
        const isMine = group.users.some(u => u.id === currentUserId);
        return (
          <button
            key={group.text}
            onClick={() => handleReactionClick(group)}
            title={group.users.map(u => u.displayName).join(', ')}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
              isMine
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50 border border-transparent'
            }`}
          >
            <span>{group.text}</span>
            <span className="text-zinc-400">{group.count}</span>
          </button>
        );
      })}

      {showInput ? (
        <div className="relative">
          <input
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value.slice(0, 20))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addReaction(inputText);
              if (e.key === 'Escape') { setShowInput(false); setInputText(''); }
            }}
            placeholder="Type reaction..."
            className="bg-zinc-800 text-zinc-100 text-xs rounded-full px-2 py-0.5 w-28 outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {popular.length > 0 && inputText === '' && (
            <div className="absolute top-full mt-1 left-0 bg-zinc-800 rounded-lg border border-zinc-700 p-2 z-10 min-w-[140px]">
              <div className="flex items-center gap-1 text-xs text-zinc-500 mb-1">
                <TrendingUp className="w-3 h-3" />
                Popular
              </div>
              {popular.slice(0, 5).map((p) => (
                <button
                  key={p.text}
                  onClick={() => addReaction(p.text)}
                  className="block w-full text-left text-xs text-zinc-300 hover:bg-zinc-700 rounded px-2 py-1"
                >
                  {p.text}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-700/30 text-zinc-400 hover:bg-zinc-600/50 hover:text-zinc-200 transition-colors"
          title="Add text reaction"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
