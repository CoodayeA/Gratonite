/**
 * MentionPopover.tsx — @mention autocomplete popup.
 * Placeholder for future implementation — currently shows a simple user search.
 */
import { useState, useEffect, useRef } from 'react';
import { AtSign } from 'lucide-react';

interface MentionPopoverProps {
  position: { top: number; left: number };
  query: string;
  onSelect: (type: 'user' | 'channel' | 'role', id: string, name: string) => void;
  onClose: () => void;
}

export default function MentionPopover({ position, query, onSelect, onClose }: MentionPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', top: position.top, left: position.left,
        width: 240, background: 'var(--bg-secondary)',
        border: '1px solid var(--border)', borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 10000,
        padding: '8px 0',
      }}
    >
      <div style={{
        padding: '6px 12px', fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <AtSign size={12} /> Mention a user, channel, or role
      </div>
      <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
        Type to search...
      </div>
    </div>
  );
}
