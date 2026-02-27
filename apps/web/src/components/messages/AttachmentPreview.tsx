import { useState } from 'react';

interface PendingAttachment {
  id: string;
  file: File;
  preview?: string;
}

interface AttachmentPreviewProps {
  attachments: PendingAttachment[];
  onRemove: (id: string) => void;
  onClearAll?: () => void;
  compact?: boolean;
}

const styles = {
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: '8px 16px 0',
  } as React.CSSProperties,
  containerCompact: {
    padding: 0,
    display: 'grid',
    gap: 6,
  } as React.CSSProperties,
  items: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    minWidth: 0,
  } as React.CSSProperties,
  itemsCompact: {
    display: 'grid',
    gap: 6,
    alignItems: 'start',
  } as React.CSSProperties,
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    minWidth: 0,
  } as React.CSSProperties,
  count: {
    fontSize: 11,
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  clearBtn: {
    border: '1px solid var(--stroke)',
    background: 'rgba(10, 16, 28, 0.52)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-pill)',
    fontSize: 11,
    padding: '3px 8px',
    cursor: 'pointer',
  } as React.CSSProperties,
  clearBtnHover: {
    color: 'var(--text)',
  } as React.CSSProperties,
  item: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    background: 'var(--bg-soft)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    maxWidth: 200,
    minWidth: 0,
  } as React.CSSProperties,
  itemCompact: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--bg-soft)',
    border: '1px solid var(--stroke)',
    width: 72,
    height: 72,
    maxWidth: 'none',
    padding: 0,
    borderRadius: 10,
    overflow: 'hidden',
  } as React.CSSProperties,
  thumb: {
    width: 40,
    height: 40,
    objectFit: 'cover',
    borderRadius: 'var(--radius-sm)',
  } as React.CSSProperties,
  thumbCompact: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: 0,
  } as React.CSSProperties,
  fileIcon: {
    width: 40,
    height: 40,
    display: 'grid',
    placeItems: 'center',
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  fileIconCompact: {
    width: '100%',
    height: '100%',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--text-faint)',
    background: 'rgba(255, 255, 255, 0.03)',
  } as React.CSSProperties,
  name: {
    fontSize: 12,
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
    flex: 1,
    maxWidth: '100%',
  } as React.CSSProperties,
  removeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-faint)',
    fontSize: 16,
    width: 20,
    height: 20,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all 0.1s',
    flexShrink: 0,
  } as React.CSSProperties,
  removeBtnCompact: {
    position: 'absolute',
    top: 4,
    right: 4,
    background: 'rgba(0, 0, 0, 0.62)',
    color: '#fff',
    borderRadius: 'var(--radius-pill)',
    width: 22,
    height: 22,
    border: 'none',
    fontSize: 16,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    transition: 'all 0.1s',
    flexShrink: 0,
  } as React.CSSProperties,
  removeBtnHover: {
    background: 'var(--danger-bg)',
    color: 'var(--danger)',
  } as React.CSSProperties,
};

function FileTypeIcon({ mimeType }: { mimeType: string; filename: string }) {
  if (mimeType.startsWith('video/')) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    );
  }
  if (mimeType.startsWith('audio/')) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    );
  }
  // Default file icon
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function RemoveButton({ onClick, label, compact }: { onClick: () => void; label: string; compact: boolean }) {
  const [hovered, setHovered] = useState(false);
  const baseStyle = compact ? styles.removeBtnCompact : styles.removeBtn;
  const style: React.CSSProperties = {
    ...baseStyle,
    ...(hovered && !compact ? styles.removeBtnHover : {}),
  };
  return (
    <button
      style={style}
      onClick={onClick}
      aria-label={label}
      title={label}
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      &times;
    </button>
  );
}

export function AttachmentPreview({ attachments, onRemove, onClearAll, compact = false }: AttachmentPreviewProps) {
  const [clearHovered, setClearHovered] = useState(false);

  if (attachments.length === 0) return null;

  return (
    <div style={compact ? styles.containerCompact : styles.container}>
      {compact && (
        <div style={styles.toolbar}>
          <span style={styles.count}>{attachments.length} ready</span>
          {onClearAll && (
            <button
              type="button"
              style={{ ...styles.clearBtn, ...(clearHovered ? styles.clearBtnHover : {}) }}
              onClick={onClearAll}
              aria-label="Clear all attachments"
              onMouseEnter={() => setClearHovered(true)}
              onMouseLeave={() => setClearHovered(false)}
            >
              Clear all
            </button>
          )}
        </div>
      )}
      <div style={compact ? styles.itemsCompact : styles.items}>
        {attachments.map((att) => (
          <div key={att.id} style={compact ? styles.itemCompact : styles.item}>
            {att.file.type.startsWith('image/') && att.preview ? (
              <img src={att.preview} alt={att.file.name} style={compact ? styles.thumbCompact : styles.thumb} />
            ) : att.file.type.startsWith('video/') && att.preview ? (
              <video src={att.preview} style={compact ? styles.thumbCompact : styles.thumb} muted />
            ) : (
              <div style={compact ? styles.fileIconCompact : styles.fileIcon}>
                <FileTypeIcon mimeType={att.file.type} filename={att.file.name} />
              </div>
            )}
            {!compact && <span style={styles.name}>{att.file.name}</span>}
            <RemoveButton
              onClick={() => onRemove(att.id)}
              label={`Remove ${att.file.name}`}
              compact={compact}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export type { PendingAttachment };
