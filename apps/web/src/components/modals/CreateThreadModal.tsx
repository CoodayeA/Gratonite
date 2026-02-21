import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUiStore } from '@/stores/ui.store';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

export function CreateThreadModal() {
  const activeModal = useUiStore((s) => s.activeModal);
  const modalData = useUiStore((s) => s.modalData);
  const closeModal = useUiStore((s) => s.closeModal);
  const openThread = useUiStore((s) => s.openThread);

  const channelId = (modalData?.['channelId'] as string | undefined) ?? undefined;
  const messageId = (modalData?.['messageId'] as string | undefined) ?? undefined;

  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeModal !== 'create-thread') return;
    setName('');
    setError('');
    setLoading(false);
  }, [activeModal]);

  function handleClose() {
    closeModal();
    setName('');
    setError('');
    setLoading(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!channelId || !name.trim()) return;
    setError('');
    setLoading(true);
    try {
      const thread = await api.threads.create(channelId, {
        name: name.trim(),
      });
      handleClose();
      openThread(thread.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal id="create-thread" title="Create Thread" onClose={handleClose} size="sm">
      <form className="modal-form" onSubmit={handleSubmit}>
        {error && <div className="modal-error">{error}</div>}
        <Input
          label="Thread Name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Thread topic"
          maxLength={100}
          required
          autoFocus
        />
        <div className="modal-footer">
          <Button variant="ghost" type="button" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={loading} disabled={!name.trim() || !channelId}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}
