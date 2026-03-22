/**
 * BlockCursor.tsx — Shows colored cursor indicator for remote editors on a block.
 */
import { useState, useEffect } from 'react';
import { onDocumentCursorUpdate } from '../../../lib/socket';

const CURSOR_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#e91e63', '#00bcd4', '#8bc34a',
];

function getColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

interface RemoteCursor {
  userId: string;
  blockId: string;
  offset: number;
  timestamp: number;
}

interface BlockCursorProps {
  channelId: string;
  blockId: string;
}

export default function BlockCursor({ channelId, blockId }: BlockCursorProps) {
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);

  useEffect(() => {
    return onDocumentCursorUpdate((payload) => {
      if (payload.channelId !== channelId) return;
      setCursors(prev => {
        const filtered = prev.filter(c => c.userId !== payload.userId && Date.now() - c.timestamp < 5000);
        if (payload.blockId === blockId) {
          filtered.push({
            userId: payload.userId,
            blockId: payload.blockId,
            offset: payload.offset,
            timestamp: Date.now(),
          });
        }
        return filtered;
      });
    });
  }, [channelId, blockId]);

  // Clean stale cursors periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setCursors(prev => prev.filter(c => Date.now() - c.timestamp < 5000));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (cursors.length === 0) return null;

  return (
    <>
      {cursors.map(cursor => (
        <div
          key={cursor.userId}
          style={{
            position: 'absolute',
            top: 0,
            right: -8,
            width: 3,
            height: '100%',
            background: getColor(cursor.userId),
            borderRadius: 2,
            opacity: 0.7,
            transition: 'opacity 0.3s',
          }}
          title={`User editing`}
        />
      ))}
    </>
  );
}
