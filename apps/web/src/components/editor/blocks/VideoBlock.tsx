/**
 * VideoBlock.tsx — Embedded video player block.
 */
import { useState } from 'react';
import { Video } from 'lucide-react';
import type { Block, VideoBlockContent } from '@gratonite/types/api';
import { useEditorContext } from '../BlockEditorContext';

interface Props { block: Block<'video'>; }

export default function VideoBlock({ block }: Props) {
  const { updateBlockContent, readOnly } = useEditorContext();
  const content = block.content as VideoBlockContent;
  const [urlInput, setUrlInput] = useState('');

  if (!content.url) {
    if (readOnly) return null;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px', border: '1px dashed var(--border)',
        borderRadius: 8, color: 'var(--text-muted)',
      }}>
        <Video size={20} />
        <input
          type="text"
          placeholder="Paste video URL and press Enter..."
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && urlInput.trim()) {
              updateBlockContent(block.id, { url: urlInput.trim() });
            }
          }}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 'var(--text-sm)',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ margin: '4px 0' }}>
      <video
        src={content.url}
        controls
        style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, display: 'block' }}
      />
      {content.caption && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
          {content.caption}
        </p>
      )}
    </div>
  );
}
