/**
 * HeadingBlock.tsx — H1/H2/H3 heading block.
 */
import type { Block, HeadingBlockContent } from '@gratonite/types';
import InlineEditor from '../inline/InlineEditor';
import { useEditorContext } from '../BlockEditorContext';

interface Props {
  block: Block<'heading'>;
  onEnter?: (offset: number) => void;
  onBackspaceAtStart?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
}

const HEADING_STYLES: Record<1 | 2 | 3, React.CSSProperties> = {
  1: { fontSize: 'var(--text-3xl)', fontWeight: 700, lineHeight: 1.2, marginTop: 16, marginBottom: 4 },
  2: { fontSize: 'var(--text-2xl)', fontWeight: 600, lineHeight: 1.25, marginTop: 12, marginBottom: 4 },
  3: { fontSize: 'var(--text-xl)', fontWeight: 600, lineHeight: 1.3, marginTop: 8, marginBottom: 2 },
};

export default function HeadingBlock({ block, onEnter, onBackspaceAtStart, onArrowUp, onArrowDown }: Props) {
  const { updateBlockContent } = useEditorContext();
  const content = block.content as HeadingBlockContent;
  const level = content.level || 1;

  return (
    <InlineEditor
      blockId={block.id}
      richText={content.richText}
      onChange={(richText) => updateBlockContent(block.id, { richText })}
      onEnter={onEnter}
      onBackspaceAtStart={onBackspaceAtStart}
      onArrowUp={onArrowUp}
      onArrowDown={onArrowDown}
      placeholder={`Heading ${level}`}
      style={{ ...HEADING_STYLES[level], color: 'var(--text-primary)' }}
      tag={`h${level}` as 'h1' | 'h2' | 'h3'}
    />
  );
}
