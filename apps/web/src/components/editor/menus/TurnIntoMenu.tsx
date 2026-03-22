/**
 * TurnIntoMenu.tsx — Sub-menu for converting a block to a different type.
 */
import { useEffect, useRef } from 'react';
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, AlertCircle, Code, ChevronRight,
} from 'lucide-react';
import type { BlockType } from '@gratonite/types';
import { useEditorContext } from '../BlockEditorContext';

interface TurnIntoMenuProps {
  blockId: string;
  position: { top: number; left: number };
  onClose: () => void;
}

const TURN_INTO_OPTIONS: { type: BlockType; label: string; icon: React.ReactNode; extra?: any }[] = [
  { type: 'text', label: 'Text', icon: <Type size={16} /> },
  { type: 'heading', label: 'Heading 1', icon: <Heading1 size={16} />, extra: { level: 1 } },
  { type: 'heading', label: 'Heading 2', icon: <Heading2 size={16} />, extra: { level: 2 } },
  { type: 'heading', label: 'Heading 3', icon: <Heading3 size={16} />, extra: { level: 3 } },
  { type: 'bulleted_list', label: 'Bulleted List', icon: <List size={16} /> },
  { type: 'numbered_list', label: 'Numbered List', icon: <ListOrdered size={16} /> },
  { type: 'checklist', label: 'Checklist', icon: <CheckSquare size={16} /> },
  { type: 'quote', label: 'Quote', icon: <Quote size={16} /> },
  { type: 'callout', label: 'Callout', icon: <AlertCircle size={16} /> },
  { type: 'code', label: 'Code', icon: <Code size={16} /> },
  { type: 'toggle', label: 'Toggle', icon: <ChevronRight size={16} /> },
];

export default function TurnIntoMenu({ blockId, position, onClose }: TurnIntoMenuProps) {
  const { turnInto, updateBlockContent } = useEditorContext();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: 200,
        maxHeight: 340,
        overflowY: 'auto',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 10001,
        padding: '4px 0',
      }}
    >
      <div style={{
        padding: '6px 12px', fontSize: 'var(--text-xs)', fontWeight: 600,
        color: 'var(--text-muted)', textTransform: 'uppercase',
      }}>
        Turn into
      </div>
      {TURN_INTO_OPTIONS.map(opt => (
        <button
          key={opt.label}
          onClick={() => {
            turnInto(blockId, opt.type);
            if (opt.extra) updateBlockContent(blockId, opt.extra);
            onClose();
          }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 12px', background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-primary)', fontSize: 'var(--text-sm)',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
        >
          <span style={{ color: 'var(--text-muted)' }}>{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
