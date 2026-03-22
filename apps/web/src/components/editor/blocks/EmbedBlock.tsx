/**
 * EmbedBlock.tsx — oEmbed / iframe embed block.
 */
import { useState } from 'react';
import { Globe } from 'lucide-react';
import type { Block, EmbedBlockContent } from '@gratonite/types/api';
import { useEditorContext } from '../BlockEditorContext';

interface Props { block: Block<'embed'>; }

/** Allowlisted embed domains for iframe sandboxing. */
const ALLOWED_EMBED_HOSTS = [
  'youtube.com', 'www.youtube.com', 'youtu.be',
  'vimeo.com', 'player.vimeo.com',
  'codepen.io', 'codesandbox.io',
  'spotify.com', 'open.spotify.com',
  'soundcloud.com',
  'twitter.com', 'x.com',
  'figma.com',
];

function isAllowedEmbed(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return ALLOWED_EMBED_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
  } catch { return false; }
}

export default function EmbedBlock({ block }: Props) {
  const { updateBlockContent, readOnly } = useEditorContext();
  const content = block.content as EmbedBlockContent;
  const [urlInput, setUrlInput] = useState('');

  if (!content.url) {
    if (readOnly) return null;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px', border: '1px dashed var(--border)',
        borderRadius: 8, color: 'var(--text-muted)',
      }}>
        <Globe size={20} />
        <input type="text" placeholder="Paste embed URL (YouTube, Vimeo, Spotify, etc.)..."
          value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && urlInput.trim()) updateBlockContent(block.id, { url: urlInput.trim() });
          }}
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}
        />
      </div>
    );
  }

  if (!isAllowedEmbed(content.url)) {
    return (
      <a href={content.url} target="_blank" rel="noopener noreferrer" style={{
        display: 'block', padding: '12px 16px', background: 'var(--bg-tertiary)',
        borderRadius: 8, border: '1px solid var(--border)', color: 'var(--accent-primary)',
        textDecoration: 'none', margin: '4px 0',
      }}>
        <Globe size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
        {content.url}
      </a>
    );
  }

  return (
    <div style={{ margin: '4px 0' }}>
      <iframe
        src={content.url}
        style={{ width: '100%', height: 360, border: 'none', borderRadius: 8 }}
        sandbox="allow-scripts allow-same-origin allow-popups"
        loading="lazy"
        title="Embedded content"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
