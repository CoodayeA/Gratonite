/**
 * DocumentChannel.tsx — Container component for GUILD_DOCUMENT channels.
 *
 * Renders the CollaborativeEditor instead of the message list when the
 * channel type is GUILD_DOCUMENT.
 */
import { lazy, Suspense } from 'react';
import { FileText } from 'lucide-react';

const CollaborativeEditor = lazy(() => import('../chat/CollaborativeEditor'));

interface DocumentChannelProps {
  channelId: string;
  channelName: string;
}

export default function DocumentChannel({ channelId, channelName }: DocumentChannelProps) {
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
        <FileText size={18} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>
          {channelName}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>
          Collaborative Document
        </span>
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            Loading editor...
          </div>
        }>
          <CollaborativeEditor channelId={channelId} channelName={channelName} />
        </Suspense>
      </div>
    </div>
  );
}
