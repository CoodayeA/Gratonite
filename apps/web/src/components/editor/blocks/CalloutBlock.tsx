/**
 * CalloutBlock.tsx — Highlighted callout with emoji and text.
 */
import type { Block, CalloutBlockContent } from '@gratonite/types/api';
import InlineEditor from '../inline/InlineEditor';
import { useEditorContext } from '../BlockEditorContext';

interface Props {
  block: Block<'callout'>;
  onEnter?: (offset: number) => void;
  onBackspaceAtStart?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
}

export default function CalloutBlock({ block, onEnter, onBackspaceAtStart, onArrowUp, onArrowDown }: Props) {
  const { updateBlockContent } = useEditorContext();
  const content = block.content as CalloutBlockContent;

  return (
    <div style={{
      display: 'flex', gap: 10, padding: '12px 16px',
      background: content.color ? `${content.color}15` : 'var(--bg-tertiary)',
      borderRadius: 8, border: '1px solid var(--border)',
      margin: '4px 0',
    }}>
      <span style={{ fontSize: 20, flexShrink: 0, userSelect: 'none' }}>
        {content.emoji || '💡'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <InlineEditor
          blockId={block.id}
          richText={content.richText}
          onChange={(richText) => updateBlockContent(block.id, { richText })}
          onEnter={onEnter}
          onBackspaceAtStart={onBackspaceAtStart}
          onArrowUp={onArrowUp}
          onArrowDown={onArrowDown}
          placeholder="Type something..."
          style={{ fontSize: 'var(--text-base)', lineHeight: 1.65, color: 'var(--text-primary)' }}
        />
      </div>
    </div>
  );
}
