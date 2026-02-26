import { useState, type MouseEvent } from 'react';

interface MessageActionBarProps {
  onReply: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onReact: (event: MouseEvent<HTMLButtonElement>) => void;
  isOwn: boolean;
  isPinned?: boolean;
}

const styles = {
  bar: {
    position: 'absolute',
    top: 6,
    right: 12,
    zIndex: 10,
    display: 'flex',
    gap: 2,
    background: 'var(--bg-float)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    padding: 2,
  } as React.CSSProperties,
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  } as React.CSSProperties,
  btnHover: {
    background: 'rgba(212, 175, 55, 0.08)',
    color: 'var(--text)',
  } as React.CSSProperties,
  btnActive: {
    color: 'var(--text)',
    background: 'rgba(255, 255, 255, 0.08)',
  } as React.CSSProperties,
  btnDangerHover: {
    background: 'rgba(255, 107, 107, 0.12)',
    color: 'var(--danger)',
  } as React.CSSProperties,
};

function ActionButton({ onClick, title, isActive, isDanger, children }: {
  onClick: ((e: MouseEvent<HTMLButtonElement>) => void) | (() => void);
  title: string;
  isActive?: boolean;
  isDanger?: boolean;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const style: React.CSSProperties = {
    ...styles.btn,
    ...(isActive ? styles.btnActive : {}),
    ...(hovered ? (isDanger ? styles.btnDangerHover : styles.btnHover) : {}),
  };
  return (
    <button
      style={style}
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
}

export function MessageActionBar({ onReply, onEdit, onDelete, onPin, onReact, isOwn, isPinned }: MessageActionBarProps) {
  return (
    <div style={styles.bar}>
      <ActionButton onClick={onReact} title="Add Reaction">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      </ActionButton>
      <ActionButton onClick={onReply} title="Reply">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 17 4 12 9 7" />
          <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
        </svg>
      </ActionButton>
      {isOwn && onEdit && (
        <ActionButton onClick={onEdit} title="Edit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </ActionButton>
      )}
      {onPin && (
        <ActionButton onClick={onPin} title="Pin" isActive={isPinned}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
          </svg>
        </ActionButton>
      )}
      {onDelete && (
        <ActionButton onClick={onDelete} title="Delete" isDanger>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </ActionButton>
      )}
    </div>
  );
}
