/**
 * TableOfContentsBlock.tsx — Auto-generated table of contents from heading blocks.
 */
import { List } from 'lucide-react';
import type { Block, HeadingBlockContent } from '@gratonite/types';
import { useEditorContext } from '../BlockEditorContext';
import { toPlainText } from '../utils/blockHelpers';

export default function TableOfContentsBlock() {
  const { blocks } = useEditorContext();

  const headings = blocks
    .filter(b => b.type === 'heading')
    .map(b => {
      const content = b.content as HeadingBlockContent;
      return {
        id: b.id,
        level: content.level,
        text: toPlainText(content.richText),
      };
    });

  if (headings.length === 0) {
    return (
      <div style={{
        padding: '12px 16px', background: 'var(--bg-tertiary)',
        borderRadius: 8, color: 'var(--text-muted)', fontSize: 'var(--text-sm)',
        display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0',
      }}>
        <List size={16} />
        Add headings to generate a table of contents
      </div>
    );
  }

  return (
    <div style={{
      padding: '12px 16px', background: 'var(--bg-tertiary)',
      borderRadius: 8, margin: '4px 0',
    }}>
      <div style={{
        fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase',
        color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.05em',
      }}>
        Table of Contents
      </div>
      {headings.map(h => (
        <div
          key={h.id}
          onClick={() => {
            document.querySelector(`[data-block-id="${h.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          style={{
            paddingTop: 3,
            paddingBottom: 3,
            paddingLeft: (h.level - 1) * 16,
            cursor: 'pointer',
            color: 'var(--accent-primary)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {h.text || 'Untitled'}
        </div>
      ))}
    </div>
  );
}
