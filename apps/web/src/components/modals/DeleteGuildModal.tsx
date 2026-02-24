import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { useUiStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/utils';

export function DeleteGuildModal() {
  const closeModal = useUiStore((s) => s.closeModal);
  const currentGuildId = useGuildsStore((s) => s.currentGuildId);
  const guild = useGuildsStore((s) => (currentGuildId ? s.guilds.get(currentGuildId) : undefined));
  const removeGuild = useGuildsStore((s) => s.removeGuild);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const isOwner = guild?.ownerId === user?.id;
  const nameMatch = guild?.name && confirmText.trim() === guild.name;

  async function handleDelete() {
    if (!currentGuildId || !isOwner || !nameMatch) return;
    setLoading(true);
    setError('');

    try {
      await api.guilds.delete(currentGuildId);
      removeGuild(currentGuildId);
      queryClient.invalidateQueries({ queryKey: ['guilds', '@me'] });
      closeModal();
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal id="delete-guild" title={`Delete "${guild?.name ?? 'Portal'}"`} size="sm">
      {!isOwner ? (
        <div>
          <p>Only the portal owner can delete this portal.</p>
          <div className="modal-footer">
            <Button variant="ghost" onClick={closeModal}>OK</Button>
          </div>
        </div>
      ) : (
        <div>
          <p>
            This will permanently delete <strong>{guild?.name}</strong> and all of its channels,
            messages, and settings. This action cannot be undone.
          </p>
          <Input
            label="Type the portal name to confirm"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={guild?.name ?? 'Portal name'}
          />

          {error && <div className="auth-error" style={{ marginTop: '12px' }}>{error}</div>}

          <div className="modal-footer">
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={loading} disabled={!nameMatch}>
              Delete Portal
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
