import { useEffect, useRef, useCallback } from 'react';
import { X, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Avatar from './Avatar';
import { useDmNotifStore, dismissDmNotif, type DmNotif } from '../../store/dmNotifStore';

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 6000;

function DmNotifItem({ notif, onDismiss }: { notif: DmNotif; onDismiss: (id: string) => void }) {
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(notif.id), AUTO_DISMISS_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [notif.id, onDismiss]);

  const handleOpen = useCallback(() => {
    onDismiss(notif.id);
    navigate(`/dm/${notif.channelId}`);
  }, [notif.id, notif.channelId, onDismiss, navigate]);

  const preview = notif.content
    ? notif.content.length > 80
      ? notif.content.slice(0, 77) + '…'
      : notif.content
    : notif.attachmentCount
      ? `📎 ${notif.attachmentCount} attachment${notif.attachmentCount > 1 ? 's' : ''}`
      : 'Sent a message';

  return (
    <div
      ref={itemRef}
      role="alert"
      aria-live="assertive"
      onClick={handleOpen}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        background: 'var(--bg-secondary)',
        border: '1.5px solid var(--stroke)',
        borderRadius: '14px',
        padding: '12px 14px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        cursor: 'pointer',
        maxWidth: '340px',
        width: '340px',
        position: 'relative',
        animation: 'dmNotifSlideIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        transition: 'opacity 0.2s, transform 0.2s',
      }}
    >
      {/* Accent bar */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: '10px',
        bottom: '10px',
        width: '3px',
        borderRadius: '0 3px 3px 0',
        background: 'var(--accent-primary)',
      }} />

      <Avatar
        userId={notif.authorId}
        avatarHash={notif.authorAvatarHash}
        displayName={notif.authorName}
        size={38}
        style={{ flexShrink: 0, marginLeft: '6px' }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <MessageCircle size={12} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--accent-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {notif.isGroup ? 'Group DM' : 'Direct Message'}
          </span>
        </div>
        <div style={{
          fontSize: '14px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '3px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {notif.authorName}
          {notif.channelName && notif.isGroup && (
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '12px' }}>
              {' '}· {notif.channelName}
            </span>
          )}
        </div>
        <div style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {preview}
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(notif.id); }}
        aria-label="Dismiss notification"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: '2px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function DmNotificationToast() {
  const notifs = useDmNotifStore();
  const visible = notifs.slice(-MAX_VISIBLE);

  if (visible.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes dmNotifSlideIn {
          from { opacity: 0; transform: translateX(60px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
      <div
        aria-label="DM notifications"
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 3000,
          pointerEvents: 'none',
        }}
      >
        {visible.map((notif: DmNotif) => (
          <div key={notif.id} style={{ pointerEvents: 'all' }}>
            <DmNotifItem notif={notif} onDismiss={dismissDmNotif} />
          </div>
        ))}
      </div>
    </>
  );
}
