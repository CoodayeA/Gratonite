/**
 * ChecklistBlock.tsx — Checkbox + text block (todo item).
 */
import type { Block, ChecklistBlockContent } from '@gratonite/types/api';
import InlineEditor from '../inline/InlineEditor';
import { useEditorContext } from '../BlockEditorContext';

interface Props {
  block: Block<'checklist'>;
  onEnter?: (offset: number) => void;
  onBackspaceAtStart?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
}

export default function ChecklistBlock({ block, onEnter, onBackspaceAtStart, onArrowUp, onArrowDown }: Props) {
  const { updateBlockContent, readOnly } = useEditorContext();
  const content = block.content as ChecklistBlockContent;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingLeft: (block.indent || 0) * 24 }}>
      <input
        type="checkbox"
        checked={content.checked}
        onChange={(e) => updateBlockContent(block.id, { checked: e.target.checked })}
        disabled={readOnly}
        style={{
          marginTop: 5,
          flexShrink: 0,
          width: 16,
          height: 16,
          accentColor: 'var(--accent-primary)',
          cursor: readOnly ? 'default' : 'pointer',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <InlineEditor
          blockId={block.id}
          richText={content.richText}
          onChange={(richText) => updateBlockContent(block.id, { richText })}
          onEnter={onEnter}
          onBackspaceAtStart={onBackspaceAtStart}
          onArrowUp={onArrowUp}
          onArrowDown={onArrowDown}
          placeholder="To-do"
          style={{
            fontSize: 'var(--text-base)',
            lineHeight: 1.65,
            color: 'var(--text-primary)',
            textDecoration: content.checked ? 'line-through' : undefined,
            opacity: content.checked ? 0.6 : 1,
          }}
        />
      </div>
    </div>
  );
}
