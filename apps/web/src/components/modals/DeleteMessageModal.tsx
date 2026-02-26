import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useUiStore } from '@/stores/ui.store';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import type { Message } from '@gratonite/types';

const styles = {
  description: {
    fontSize: 14,
    color: 'var(--text-muted)',
    marginBottom: 12,
  } as React.CSSProperties,
  previewBox: {
    padding: '10px 12px',
    background: 'rgba(6, 10, 18, 0.5)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    marginBottom: 12,
  } as React.CSSProperties,
  previewAuthor: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
    display: 'block',
    marginBottom: 4,
  } as React.CSSProperties,
  previewContent: {
    fontSize: 13,
    color: 'var(--text-muted)',
    lineHeight: 1.4,
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    margin: 0,
  } as React.CSSProperties,
  error: {
    padding: '10px 14px',
    background: 'var(--danger-bg)',
    border: '1px solid rgba(255, 107, 107, 0.25)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger)',
    fontSize: 13,
  } as React.CSSProperties,
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '16px 0 0',
  } as React.CSSProperties,
  cancelBtn: {
    padding: '6px 14px',
    background: 'transparent',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  } as React.CSSProperties,
  cancelBtnHover: {
    background: 'rgba(255, 255, 255, 0.06)',
  } as React.CSSProperties,
  deleteBtn: {
    padding: '6px 14px',
    background: 'var(--danger, #f23f43)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s ease, opacity 0.15s ease',
  } as React.CSSProperties,
  deleteBtnHover: {
    background: '#d63031',
  } as React.CSSProperties,
};

export function DeleteMessageModal() {
  const modalData = useUiStore((s) => s.modalData);
  const closeModal = useUiStore((s) => s.closeModal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelHover, setCancelHover] = useState(false);
  const [deleteHover, setDeleteHover] = useState(false);

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
      <p style={styles.description}>
        Are you sure you want to delete this message? This cannot be undone.
      </p>
      {message && (
        <div style={styles.previewBox}>
          <span style={styles.previewAuthor}>{message.author?.displayName ?? 'Unknown'}</span>
          <p style={styles.previewContent}>{message.content?.slice(0, 200)}</p>
        </div>
      )}
      {error && <div style={styles.error}>{error}</div>}
      <div style={styles.footer}>
        <button
          style={{
            ...styles.cancelBtn,
            ...(cancelHover ? styles.cancelBtnHover : {}),
          }}
          onClick={closeModal}
          onMouseEnter={() => setCancelHover(true)}
          onMouseLeave={() => setCancelHover(false)}
        >
          Cancel
        </button>
        <button
          style={{
            ...styles.deleteBtn,
            ...(deleteHover ? styles.deleteBtnHover : {}),
            ...(loading ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
          }}
          onClick={handleDelete}
          onMouseEnter={() => setDeleteHover(true)}
          onMouseLeave={() => setDeleteHover(false)}
          disabled={loading}
        >
          {loading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}
