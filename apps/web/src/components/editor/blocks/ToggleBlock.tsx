/**
 * ToggleBlock.tsx — Expandable toggle block with nested children.
 */
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Block, ToggleBlockContent } from '@gratonite/types/api';
import InlineEditor from '../inline/InlineEditor';
import { useEditorContext } from '../BlockEditorContext';

interface Props {
  block: Block<'toggle'>;
  onEnter?: (offset: number) => void;
  onBackspaceAtStart?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  renderBlock?: (block: Block) => React.ReactNode;
}

export default function ToggleBlock({ block, onEnter, onBackspaceAtStart, onArrowUp, onArrowDown, renderBlock }: Props) {
  const { updateBlockContent } = useEditorContext();
  const content = block.content as ToggleBlockContent;
  const [open, setOpen] = useState(false);

  return (
    <div style={{ margin: '2px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            background: 'none', border: 'none', padding: 2, cursor: 'pointer',
            color: 'var(--text-muted)', transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s', flexShrink: 0, marginTop: 3,
          }}
          tabIndex={-1}
        >
          <ChevronRight size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <InlineEditor
            blockId={block.id}
            richText={content.richText}
            onChange={(richText) => updateBlockContent(block.id, { richText })}
            onEnter={onEnter}
            onBackspaceAtStart={onBackspaceAtStart}
            onArrowUp={onArrowUp}
            onArrowDown={onArrowDown}
            placeholder="Toggle heading"
            style={{ fontSize: 'var(--text-base)', lineHeight: 1.65, color: 'var(--text-primary)', fontWeight: 500 }}
          />
        </div>
      </div>
      {open && content.children && content.children.length > 0 && (
        <div style={{ paddingLeft: 24, borderLeft: '2px solid var(--border)', marginLeft: 8, marginTop: 2 }}>
          {content.children.map(child => renderBlock ? renderBlock(child) : null)}
        </div>
      )}
      {open && (!content.children || content.children.length === 0) && (
        <div style={{ paddingLeft: 24, color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontStyle: 'italic', marginTop: 2 }}>
          Empty toggle. Click to add content.
        </div>
      )}
    </div>
  );
}
