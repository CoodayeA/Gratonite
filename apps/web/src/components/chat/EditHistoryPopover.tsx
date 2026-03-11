import { useState, useRef, useEffect } from 'react';
import { API_BASE } from '../../lib/api';

type EditHistoryEntry = {
  id: string;
  messageId: string;
  content: string;
  editedAt: string;
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function EditHistoryPopover({
  channelId,
  messageApiId,
}: {
  channelId: string;
  messageApiId: string;
}) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<EditHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleClick = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/channels/${channelId}/messages/${messageApiId}/history`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('gratonite_access_token')}`,
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      } else {
        setHistory([]);
      }
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <span style={{ position: 'relative', display: 'inline' }} ref={popoverRef}>
      <span
        onClick={handleClick}
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          marginLeft: '4px',
          cursor: 'pointer',
          textDecoration: 'none',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLSpanElement).style.textDecoration = 'underline';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLSpanElement).style.textDecoration = 'none';
        }}
      >
        (edited)
      </span>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 100,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--stroke)',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
            padding: '10px 12px',
            minWidth: '260px',
            maxWidth: '380px',
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
            }}
          >
            Edit History
          </div>
          {loading ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 0' }}>
              Loading...
            </div>
          ) : history.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 0' }}>
              No edit history found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: '6px 8px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '6px',
                    borderLeft: '3px solid var(--accent-primary)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      lineHeight: '1.4',
                      wordBreak: 'break-word',
                    }}
                  >
                    {entry.content}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      marginTop: '4px',
                    }}
                  >
                    {relativeTime(entry.editedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
