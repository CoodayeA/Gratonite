/**
 * ImageBlock.tsx — Image block with URL input, display, and caption.
 */
import { useState } from 'react';
import { ImagePlus } from 'lucide-react';
import type { Block, ImageBlockContent } from '@gratonite/types';
import { useEditorContext } from '../BlockEditorContext';

interface Props { block: Block<'image'>; }

export default function ImageBlock({ block }: Props) {
  const { updateBlockContent, readOnly } = useEditorContext();
  const content = block.content as ImageBlockContent;
  const [urlInput, setUrlInput] = useState('');

  if (!content.url) {
    if (readOnly) return null;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px', border: '1px dashed var(--border)',
        borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer',
      }}>
        <ImagePlus size={20} />
        <input
          type="text"
          placeholder="Paste image URL and press Enter..."
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && urlInput.trim()) {
              updateBlockContent(block.id, { url: urlInput.trim() });
              setUrlInput('');
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
      <img
        src={content.url}
        alt={content.caption || ''}
        style={{
          maxWidth: '100%',
          maxHeight: 500,
          borderRadius: 8,
          display: 'block',
        }}
        loading="lazy"
      />
      {!readOnly && (
        <input
          type="text"
          value={content.caption || ''}
          onChange={(e) => updateBlockContent(block.id, { caption: e.target.value })}
          placeholder="Add a caption..."
          style={{
            width: '100%', marginTop: 4, background: 'none', border: 'none',
            outline: 'none', color: 'var(--text-muted)', fontSize: 'var(--text-sm)',
            textAlign: 'center',
          }}
        />
      )}
      {readOnly && content.caption && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
          {content.caption}
        </p>
      )}
    </div>
  );
}
