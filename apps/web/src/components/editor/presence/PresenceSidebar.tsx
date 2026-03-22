/**
 * PresenceSidebar.tsx — Shows active editors with avatars.
 */
import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { apiFetch } from '../../../lib/api/_core';
import { onDocumentPresenceUpdate } from '../../../lib/socket';
import Avatar from '../../ui/Avatar';

interface Editor {
  id: string;
  username: string;
  displayName?: string;
  avatarHash: string | null;
}

interface PresenceSidebarProps {
  channelId: string;
}

const CURSOR_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#e91e63', '#00bcd4', '#8bc34a',
];

function getColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

export default function PresenceSidebar({ channelId }: PresenceSidebarProps) {
  const [editors, setEditors] = useState<Editor[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/channels/${channelId}/document/presence`);
        if (Array.isArray(res)) setEditors(res as Editor[]);
      } catch { /* ignore */ }
    })();
  }, [channelId]);

  useEffect(() => {
    return onDocumentPresenceUpdate((payload) => {
      if (payload.channelId !== channelId) return;
      if (payload.action === 'join' && payload.user) {
        setEditors(prev => {
          if (prev.some(e => e.id === payload.user.userId)) return prev;
          return [...prev, {
            id: payload.user.userId,
            username: payload.user.username || 'User',
            avatarHash: payload.user.avatarHash || null,
          }];
        });
      } else if (payload.action === 'leave' && payload.user) {
        setEditors(prev => prev.filter(e => e.id !== payload.user.userId));
      }
    });
  }, [channelId]);

  if (editors.length === 0) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0',
    }}>
      <Users size={14} style={{ color: 'var(--text-muted)', marginRight: 4 }} />
      {editors.map(editor => (
        <div
          key={editor.id}
          title={editor.displayName || editor.username}
          style={{
            width: 26, height: 26, borderRadius: '50%',
            border: `2px solid ${getColor(editor.id)}`,
            overflow: 'hidden', flexShrink: 0,
          }}
        >
          <Avatar
            userId={editor.id}
            avatarHash={editor.avatarHash}
            displayName={editor.username}
            size={22}
          />
        </div>
      ))}
      {editors.length > 0 && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginLeft: 2 }}>
          {editors.length} editing
        </span>
      )}
    </div>
  );
}
