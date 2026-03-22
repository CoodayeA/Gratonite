/**
 * BlockActionMenu.tsx — Context menu for block operations (duplicate, delete, move, turn into, color).
 */
import { useEffect, useRef } from 'react';
import { Copy, Trash2, ArrowUp, ArrowDown, Palette, RefreshCw } from 'lucide-react';
import type { BlockType } from '@gratonite/types';
import { useEditorContext } from '../BlockEditorContext';

interface BlockActionMenuProps {
  blockId: string;
  position: { top: number; left: number };
  onClose: () => void;
  onTurnInto: () => void;
}

export default function BlockActionMenu({ blockId, position, onClose, onTurnInto }: BlockActionMenuProps) {
  const { duplicateBlock, deleteBlock, blocks, moveBlock } = useEditorContext();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const idx = blocks.findIndex(b => b.id === blockId);

  const actions = [
    {
      label: 'Turn into',
      icon: <RefreshCw size={14} />,
      onClick: () => { onTurnInto(); },
    },
    {
      label: 'Duplicate',
      icon: <Copy size={14} />,
      onClick: () => { duplicateBlock(blockId); onClose(); },
    },
    ...(idx > 0 ? [{
      label: 'Move up',
      icon: <ArrowUp size={14} />,
      onClick: () => {
        const prevId = idx >= 2 ? blocks[idx - 2].id : undefined;
        moveBlock(blockId, prevId);
        onClose();
      },
    }] : []),
    ...(idx < blocks.length - 1 ? [{
      label: 'Move down',
      icon: <ArrowDown size={14} />,
      onClick: () => {
        moveBlock(blockId, blocks[idx + 1].id);
        onClose();
      },
    }] : []),
    {
      label: 'Delete',
      icon: <Trash2 size={14} />,
      onClick: () => { deleteBlock(blockId); onClose(); },
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: 200,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 10000,
        padding: '4px 0',
      }}
    >
      {actions.map(action => (
        <button
          key={action.label}
          onClick={action.onClick}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', background: 'none', border: 'none',
            cursor: 'pointer', color: (action as any).danger ? 'var(--error, #ed4245)' : 'var(--text-primary)',
            fontSize: 'var(--text-sm)', textAlign: 'left',
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
}
