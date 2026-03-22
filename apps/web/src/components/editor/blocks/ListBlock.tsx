/**
 * ListBlock.tsx — Bulleted list and numbered list items.
 */
import type { Block, ListBlockContent } from '@gratonite/types/api';
import InlineEditor from '../inline/InlineEditor';
import { useEditorContext } from '../BlockEditorContext';

interface Props {
  block: Block<'bulleted_list'> | Block<'numbered_list'>;
  index?: number;
  onEnter?: (offset: number) => void;
  onBackspaceAtStart?: () => void;
  onSlash?: (rect: DOMRect) => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
}

export default function ListBlock({ block, index = 0, onEnter, onBackspaceAtStart, onSlash, onArrowUp, onArrowDown }: Props) {
  const { updateBlockContent } = useEditorContext();
  const content = block.content as ListBlockContent;
  const isBulleted = block.type === 'bulleted_list';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingLeft: (block.indent || 0) * 24 }}>
      <span style={{
        flexShrink: 0,
        width: 20,
        textAlign: 'right',
        color: 'var(--text-muted)',
        fontSize: 'var(--text-base)',
        lineHeight: '1.65',
        userSelect: 'none',
      }}>
        {isBulleted ? '•' : `${index + 1}.`}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <InlineEditor
          blockId={block.id}
          richText={content.richText}
          onChange={(richText) => updateBlockContent(block.id, { richText })}
          onEnter={onEnter}
          onBackspaceAtStart={onBackspaceAtStart}
          onSlash={onSlash}
          onArrowUp={onArrowUp}
          onArrowDown={onArrowDown}
          placeholder="List item"
          style={{ fontSize: 'var(--text-base)', lineHeight: 1.65, color: 'var(--text-primary)' }}
        />
      </div>
    </div>
  );
}
