/**
 * ColumnLayoutBlock.tsx — Multi-column layout block.
 */
import type { Block, ColumnLayoutBlockContent } from '@gratonite/types';

interface Props {
  block: Block<'column_layout'>;
  renderBlock?: (block: Block) => React.ReactNode;
}

export default function ColumnLayoutBlock({ block, renderBlock }: Props) {
  const content = block.content as ColumnLayoutBlockContent;
  const columns = content.columns || [];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: columns.map(c => `${c.width || Math.floor(100 / columns.length)}%`).join(' '),
      gap: 16,
      margin: '8px 0',
    }}>
      {columns.map((col, i) => (
        <div key={i} style={{
          minHeight: 40, padding: 8,
          border: '1px dashed var(--border)',
          borderRadius: 6,
        }}>
          {col.children && col.children.length > 0
            ? col.children.map(child => renderBlock ? renderBlock(child) : null)
            : <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>Column {i + 1}</div>
          }
        </div>
      ))}
    </div>
  );
}
