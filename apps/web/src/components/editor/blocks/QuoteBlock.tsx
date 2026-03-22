/**
 * QuoteBlock.tsx — Block quote with left border accent.
 */
import type { Block, QuoteBlockContent } from '@gratonite/types/api';
import InlineEditor from '../inline/InlineEditor';
import { useEditorContext } from '../BlockEditorContext';

interface Props {
  block: Block<'quote'>;
  onEnter?: (offset: number) => void;
  onBackspaceAtStart?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
}

export default function QuoteBlock({ block, onEnter, onBackspaceAtStart, onArrowUp, onArrowDown }: Props) {
  const { updateBlockContent } = useEditorContext();
  const content = block.content as QuoteBlockContent;

  return (
    <div style={{
      borderLeft: '3px solid var(--accent-primary)',
      paddingLeft: 14, margin: '4px 0',
    }}>
      <InlineEditor
        blockId={block.id}
        richText={content.richText}
        onChange={(richText) => updateBlockContent(block.id, { richText })}
        onEnter={onEnter}
        onBackspaceAtStart={onBackspaceAtStart}
        onArrowUp={onArrowUp}
        onArrowDown={onArrowDown}
        placeholder="Quote"
        style={{
          fontSize: 'var(--text-base)', lineHeight: 1.65,
          color: 'var(--text-secondary)', fontStyle: 'italic',
        }}
      />
    </div>
  );
}
