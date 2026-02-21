import type { Message } from '@gratonite/types';

interface ReplyPreviewProps {
  message: Message;
  onCancel: () => void;
}

export function ReplyPreview({ message, onCancel }: ReplyPreviewProps) {
  const author = (message as any).author;
  const displayName = author?.displayName ?? 'Unknown';
  const snippet = message.content?.slice(0, 100) ?? '';

  return (
    <div className="reply-preview">
      <div className="reply-preview-content">
        <span className="reply-preview-label">Replying to </span>
        <span className="reply-preview-author">{displayName}</span>
        <span className="reply-preview-snippet">{snippet}{message.content && message.content.length > 100 ? '...' : ''}</span>
      </div>
      <button className="reply-preview-close" onClick={onCancel} aria-label="Cancel reply">
        &times;
      </button>
    </div>
  );
}
