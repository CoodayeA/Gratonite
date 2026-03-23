/**
 * MessageLinkPreview — Item 90: Inline quote for Gratonite message links
 * When a user pastes a message URL like /guilds/xxx/channels/yyy#msgId,
 * this component fetches and shows an inline preview.
 */
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface Props {
  messageUrl: string;
}

function parseMessageUrl(url: string): { channelId: string; messageId: string } | null {
  // Match patterns like /channels/channelId/messages/messageId or channelId#messageId
  const match = url.match(/channels\/([a-f0-9-]+)(?:\/messages\/|#)([a-f0-9-]+)/i);
  if (match) return { channelId: match[1], messageId: match[2] };
  return null;
}

export const MessageLinkPreview = ({ messageUrl }: Props) => {
  const [message, setMessage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const parsed = parseMessageUrl(messageUrl);
    if (!parsed) { setLoading(false); return; }

    api.get<any>(`/channels/${parsed.channelId}/messages?around=${parsed.messageId}&limit=1`)
      .then((data: any) => {
        const msgs = Array.isArray(data) ? data : data?.messages || [];
        const msg = msgs.find((m: any) => m.id === parsed.messageId) || msgs[0];
        if (msg) setMessage(msg);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [messageUrl]);

  if (loading) return null;
  if (!message) return null;

  return (
    <div style={{
      borderLeft: '3px solid var(--accent-primary)',
      padding: '8px 12px',
      marginTop: '4px',
      marginBottom: '4px',
      background: 'var(--bg-tertiary)',
      borderRadius: '0 6px 6px 0',
      fontSize: '13px',
    }}>
      <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--accent-primary)', marginBottom: '4px' }}>
        {message.author?.displayName || message.author?.username || 'Unknown'}
      </div>
      <div style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>
        {(message.content || '').slice(0, 200)}{(message.content?.length || 0) > 200 ? '...' : ''}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
        {message.createdAt ? new Date(message.createdAt).toLocaleString() : ''}
      </div>
    </div>
  );
};

export default MessageLinkPreview;
