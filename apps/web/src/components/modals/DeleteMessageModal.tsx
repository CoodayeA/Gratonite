import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useUiStore } from '@/stores/ui.store';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import type { Message } from '@gratonite/types';

export function DeleteMessageModal() {
  const modalData = useUiStore((s) => s.modalData);
  const closeModal = useUiStore((s) => s.closeModal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const message = modalData?.['message'] as (Message & { author?: { displayName: string } }) | undefined;
  const channelId = modalData?.['channelId'] as string | undefined;

  async function handleDelete() {
    if (!message || !channelId) return;
    setLoading(true);
    setError('');
    try {
      await api.messages.delete(channelId, message.id);
      closeModal();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal id="delete-message" title="Delete Message" size="sm">
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>
        Are you sure you want to delete this message? This cannot be undone.
      </p>
      {message && (
        <div className="message-preview-box">
          <span className="message-preview-author">{message.author?.displayName ?? 'Unknown'}</span>
          <p className="message-preview-content">{message.content?.slice(0, 200)}</p>
        </div>
      )}
      {error && <div className="modal-error">{error}</div>}
      <div className="modal-footer" style={{ padding: '16px 0 0' }}>
        <button className="btn btn-ghost btn-sm" onClick={closeModal}>Cancel</button>
        <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={loading}>
          {loading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}
