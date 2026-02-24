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

export function AttachmentPreview({ attachments, onRemove, onClearAll, compact = false }: AttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className={`attachment-preview ${compact ? 'attachment-preview-compact' : ''}`}>
      {compact && (
        <div className="attachment-preview-toolbar">
          <span className="attachment-preview-count">{attachments.length} ready</span>
          {onClearAll && (
            <button
              type="button"
              className="attachment-preview-clear"
              onClick={onClearAll}
              aria-label="Clear all attachments"
            >
              Clear all
            </button>
          )}
        </div>
      )}
      <div className="attachment-preview-items">
        {attachments.map((att) => (
          <div key={att.id} className={`attachment-preview-item ${compact ? 'attachment-preview-item-compact' : ''}`}>
            {att.file.type.startsWith('image/') && att.preview ? (
              <img src={att.preview} alt={att.file.name} className="attachment-preview-thumb" />
            ) : (
              <div className="attachment-preview-file">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
            )}
            {!compact && <span className="attachment-preview-name">{att.file.name}</span>}
            <button
              className="attachment-preview-remove"
              onClick={() => onRemove(att.id)}
              aria-label={`Remove ${att.file.name}`}
              title={`Remove ${att.file.name}`}
              type="button"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { PendingAttachment };
