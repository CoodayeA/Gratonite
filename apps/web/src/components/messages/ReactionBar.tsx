import { useAuthStore } from '@/stores/auth.store';
import type { MouseEvent } from 'react';

interface Reaction {
  emoji: string;
  count: number;
  userIds?: string[];
}

interface ReactionBarProps {
  reactions: Reaction[];
  onToggle: (emoji: string) => void;
  onAddReaction: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function ReactionBar({ reactions, onToggle, onAddReaction }: ReactionBarProps) {
  const userId = useAuthStore((s) => s.user?.id);

  if (!reactions.length) return null;

  return (
    <div className="reaction-bar">
      {reactions.map((r) => {
        const iReacted = r.userIds?.includes(userId ?? '') ?? false;
        return (
          <button
            key={r.emoji}
            className={`reaction-pill ${iReacted ? 'reaction-pill-active' : ''}`}
            onClick={() => onToggle(r.emoji)}
          >
            <span className="reaction-emoji">{r.emoji}</span>
            <span className="reaction-count">{r.count}</span>
          </button>
        );
      })}
      <button className="reaction-pill reaction-pill-add" onClick={onAddReaction} title="Add reaction">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </button>
    </div>
  );
}
