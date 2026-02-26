import { useState } from 'react';
import type { Message } from '@gratonite/types';

interface ReplyPreviewProps {
  message: Message;
  onCancel: () => void;
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    background: 'var(--bg-soft)',
    borderTop: '1px solid var(--stroke)',
    borderLeft: '2px solid var(--accent)',
    flexShrink: 0,
  } as React.CSSProperties,
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
    fontSize: 13,
  } as React.CSSProperties,
  label: {
    color: 'var(--text-faint)',
    flexShrink: 0,
  } as React.CSSProperties,
  author: {
    fontWeight: 600,
    color: 'var(--text)',
    flexShrink: 0,
  } as React.CSSProperties,
  snippet: {
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginLeft: 4,
  } as React.CSSProperties,
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-faint)',
    fontSize: 18,
    width: 24,
    height: 24,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all 0.1s',
    flexShrink: 0,
  } as React.CSSProperties,
  closeBtnHover: {
    background: 'rgba(255, 255, 255, 0.06)',
    color: 'var(--text)',
  } as React.CSSProperties,
};

export function ReplyPreview({ message, onCancel }: ReplyPreviewProps) {
  const [closeHovered, setCloseHovered] = useState(false);
  const author = (message as any).author;
  const displayName = author?.displayName ?? 'Unknown';
  const snippet = message.content?.slice(0, 100) ?? '';

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <span style={styles.label}>Replying to </span>
        <span style={styles.author}>{displayName}</span>
        <span style={styles.snippet}>{snippet}{message.content && message.content.length > 100 ? '...' : ''}</span>
      </div>
      <button
        style={{ ...styles.closeBtn, ...(closeHovered ? styles.closeBtnHover : {}) }}
        onClick={onCancel}
        aria-label="Cancel reply"
        onMouseEnter={() => setCloseHovered(true)}
        onMouseLeave={() => setCloseHovered(false)}
      >
        &times;
      </button>
    </div>
  );
}
