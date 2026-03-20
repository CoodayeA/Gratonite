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
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);
  const [addBtnHovered, setAddBtnHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadReactions();
  }, [messageId]);

  useEffect(() => {
    if (showInput && guildId) loadPopular();
  }, [showInput, guildId]);

  useEffect(() => {
    if (showInput && inputRef.current) inputRef.current.focus();
  }, [showInput]);

  // Close input on outside click
  useEffect(() => {
    if (!showInput) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowInput(false);
        setInputText('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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

  // Don't render anything if no reactions and input not open — the + button shows via the message action bar
  if (reactions.length === 0 && !showInput) return null;

  return (
    <div ref={containerRef} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
      {reactions.map((group) => {
        const isMine = group.users.some(u => u.id === currentUserId);
        const isHovered = hoveredReaction === group.text;
        return (
          <button
            key={group.text}
            onClick={() => handleReactionClick(group)}
            onMouseEnter={() => setHoveredReaction(group.text)}
            onMouseLeave={() => setHoveredReaction(null)}
            title={group.users.map(u => u.displayName || u.username).join(', ')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: isMine
                ? 'rgba(var(--accent-primary-rgb, 139,92,246), 0.15)'
                : isHovered ? 'var(--bg-modifier-hover, rgba(255,255,255,0.06))' : 'var(--bg-tertiary)',
              border: `1px solid ${isMine ? 'var(--accent-primary)' : 'var(--stroke)'}`,
              cursor: 'pointer',
              fontSize: '12px',
              color: isMine ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s',
              fontWeight: 500,
              lineHeight: '18px',
            }}
          >
            <span>{group.text}</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>{group.count}</span>
          </button>
        );
      })}

      {showInput ? (
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value.slice(0, 20))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addReaction(inputText);
              if (e.key === 'Escape') { setShowInput(false); setInputText(''); }
            }}
            placeholder="React..."
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              borderRadius: '12px',
              padding: '2px 10px',
              width: '100px',
              outline: 'none',
              border: '1px solid var(--accent-primary)',
              lineHeight: '18px',
            }}
          />
          {popular.length > 0 && inputText === '' && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              background: 'var(--bg-elevated, var(--bg-secondary))',
              borderRadius: '8px',
              border: '1px solid var(--stroke)',
              padding: '6px',
              zIndex: 50,
              minWidth: '140px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', padding: '0 4px' }}>
                <TrendingUp size={10} />
                Popular
              </div>
              {popular.slice(0, 5).map((p) => (
                <button
                  key={p.text}
                  onClick={() => addReaction(p.text)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    background: 'none',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '3px 6px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-modifier-hover, rgba(255,255,255,0.06))')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  {p.text}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        reactions.length > 0 && (
          <button
            onClick={() => setShowInput(true)}
            onMouseEnter={() => setAddBtnHovered(true)}
            onMouseLeave={() => setAddBtnHovered(false)}
            title="Add text reaction"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '22px',
              borderRadius: '12px',
              background: addBtnHovered ? 'var(--bg-modifier-hover, rgba(255,255,255,0.06))' : 'var(--bg-tertiary)',
              border: '1px solid var(--stroke)',
              cursor: 'pointer',
              color: addBtnHovered ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'all 0.15s',
              padding: 0,
            }}
          >
            <Plus size={12} />
          </button>
        )
      )}
    </div>
  );
}
