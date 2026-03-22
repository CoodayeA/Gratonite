/**
 * EmbedDocument.tsx — Fullscreen BlockEditor for mobile WebView embedding.
 * Renders the editor without the app shell at /embed/document/:channelId.
 */
import { useParams } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const BlockEditor = lazy(() => import('../components/editor/BlockEditor'));

export default function EmbedDocument() {
  const { channelId } = useParams<{ channelId: string }>();

  if (!channelId) {
    return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Missing channel ID</div>;
  }

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-app)' }}>
      <Suspense fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 8 }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          Loading editor...
        </div>
      }>
        <BlockEditor channelId={channelId} channelName="" />
      </Suspense>
    </div>
  );
}
