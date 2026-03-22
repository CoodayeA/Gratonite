/**
 * AudioBlock.tsx — Audio player block.
 */
import { useState } from 'react';
import { Music } from 'lucide-react';
import type { Block, AudioBlockContent } from '@gratonite/types';
import { useEditorContext } from '../BlockEditorContext';

interface Props { block: Block<'audio'>; }

export default function AudioBlock({ block }: Props) {
  const { updateBlockContent, readOnly } = useEditorContext();
  const content = block.content as AudioBlockContent;
  const [urlInput, setUrlInput] = useState('');

  if (!content.url) {
    if (readOnly) return null;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px', border: '1px dashed var(--border)',
        borderRadius: 8, color: 'var(--text-muted)',
      }}>
        <Music size={20} />
        <input type="text" placeholder="Paste audio URL and press Enter..."
          value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && urlInput.trim()) updateBlockContent(block.id, { url: urlInput.trim() });
          }}
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}
        />
      </div>
    );
  }

  return (
    <div style={{ margin: '4px 0' }}>
      <audio src={content.url} controls style={{ width: '100%', maxWidth: 500 }} />
    </div>
  );
}
