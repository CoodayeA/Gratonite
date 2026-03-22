/**
 * DocumentChannel.tsx — Container component for GUILD_DOCUMENT channels.
 *
 * Renders the Notion-style BlockEditor for document channels.
 */
import { lazy, Suspense } from 'react';
import { FileText, Loader2 } from 'lucide-react';

const BlockEditor = lazy(() => import('../editor/BlockNoteEditor'));

interface DocumentChannelProps {
  channelId: string;
  channelName: string;
  guildId?: string;
  readOnly?: boolean;
}

export default function DocumentChannel({ channelId, channelName, guildId, readOnly }: DocumentChannelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Channel header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        minHeight: 48,
      }}>
        <FileText size={18} style={{ color: 'var(--accent-secondary, #7c5cfc)' }} />
        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>
          {channelName}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>
          Document
        </span>
      </div>

      {/* Block editor body */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 8 }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            Loading editor...
          </div>
        }>
          <BlockEditor channelId={channelId} channelName={channelName} guildId={guildId} readOnly={readOnly} />
        </Suspense>
      </div>
    </div>
  );
}
