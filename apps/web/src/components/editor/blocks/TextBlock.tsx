/**
 * TextBlock.tsx — Basic paragraph text block.
 */
import type { Block, TextBlockContent } from '@gratonite/types/api';
import InlineEditor from '../inline/InlineEditor';
import { useEditorContext } from '../BlockEditorContext';

interface Props {
  block: Block<'text'>;
  onEnter?: (offset: number) => void;
  onBackspaceAtStart?: () => void;
  onSlash?: (rect: DOMRect) => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
}

export default function TextBlock({ block, onEnter, onBackspaceAtStart, onSlash, onArrowUp, onArrowDown }: Props) {
  const { updateBlockContent } = useEditorContext();

  return (
    <InlineEditor
      blockId={block.id}
      richText={(block.content as TextBlockContent).richText}
      onChange={(richText) => updateBlockContent(block.id, { richText })}
      onEnter={onEnter}
      onBackspaceAtStart={onBackspaceAtStart}
      onSlash={onSlash}
      onArrowUp={onArrowUp}
      onArrowDown={onArrowDown}
      placeholder="Type something, or press '/' for commands..."
      style={{ fontSize: 'var(--text-base)', lineHeight: 1.65, color: 'var(--text-primary)' }}
    />
  );
}
