/**
 * FileBlock.tsx — File attachment block.
 */
import { useState } from 'react';
import { FileIcon, Download } from 'lucide-react';
import type { Block, FileBlockContent } from '@gratonite/types/api';
import { useEditorContext } from '../BlockEditorContext';

interface Props { block: Block<'file'>; }

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function FileBlock({ block }: Props) {
  const { updateBlockContent, readOnly } = useEditorContext();
  const content = block.content as FileBlockContent;
  const [urlInput, setUrlInput] = useState('');

  if (!content.url) {
    if (readOnly) return null;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px', border: '1px dashed var(--border)',
        borderRadius: 8, color: 'var(--text-muted)',
      }}>
        <FileIcon size={20} />
        <input type="text" placeholder="Paste file URL and press Enter..."
          value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && urlInput.trim()) {
              const name = urlInput.trim().split('/').pop() || 'file';
              updateBlockContent(block.id, { url: urlInput.trim(), filename: name });
            }
          }}
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}
        />
      </div>
    );
  }

  return (
    <a
      href={content.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', background: 'var(--bg-tertiary)',
        borderRadius: 8, textDecoration: 'none', color: 'var(--text-primary)',
        border: '1px solid var(--border)', margin: '4px 0',
      }}
    >
      <FileIcon size={24} style={{ flexShrink: 0, color: 'var(--accent-primary)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {content.filename}
        </div>
        {content.size && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{formatSize(content.size)}</div>}
      </div>
      <Download size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
    </a>
  );
}
