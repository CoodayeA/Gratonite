/**
 * ChildPageBlock.tsx — Link to a nested document (child page).
 */
import { FileText } from 'lucide-react';
import type { Block, ChildPageBlockContent } from '@gratonite/types/api';

interface Props { block: Block<'child_page'>; }

export default function ChildPageBlock({ block }: Props) {
  const content = block.content as ChildPageBlockContent;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px', background: 'var(--bg-tertiary)',
      borderRadius: 6, cursor: 'pointer', margin: '4px 0',
      border: '1px solid var(--border)',
    }}>
      <FileText size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
        {content.title || 'Untitled'}
      </span>
    </div>
  );
}
