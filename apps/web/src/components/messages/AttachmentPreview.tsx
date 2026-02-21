interface PendingAttachment {
  id: string;
  file: File;
  preview?: string;
}

interface AttachmentPreviewProps {
  attachments: PendingAttachment[];
  onRemove: (id: string) => void;
}

export function AttachmentPreview({ attachments, onRemove }: AttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="attachment-preview">
      {attachments.map((att) => (
        <div key={att.id} className="attachment-preview-item">
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
          <span className="attachment-preview-name">{att.file.name}</span>
          <button className="attachment-preview-remove" onClick={() => onRemove(att.id)} aria-label="Remove">
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}

export type { PendingAttachment };
