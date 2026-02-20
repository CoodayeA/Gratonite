import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useUiStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/utils';

export function LeaveGuildModal() {
  const closeModal = useUiStore((s) => s.closeModal);
  const currentGuildId = useGuildsStore((s) => s.currentGuildId);
  const guild = useGuildsStore((s) => (currentGuildId ? s.guilds.get(currentGuildId) : undefined));
  const removeGuild = useGuildsStore((s) => s.removeGuild);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isOwner = guild?.ownerId === user?.id;

  async function handleLeave() {
    if (!currentGuildId) return;
    setLoading(true);
    setError('');

    try {
      await api.guilds.leave(currentGuildId);
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
    <Modal id="leave-guild" title={`Leave "${guild?.name ?? 'Server'}"`} size="sm">
      {isOwner ? (
        <div>
          <p>You are the owner of this server. Transfer ownership before leaving.</p>
          <div className="modal-footer">
            <Button variant="ghost" onClick={closeModal}>OK</Button>
          </div>
        </div>
      ) : (
        <div>
          <p>
            Are you sure you want to leave <strong>{guild?.name}</strong>?
            You will need a new invite to rejoin.
          </p>

          {error && <div className="auth-error" style={{ marginTop: '12px' }}>{error}</div>}

          <div className="modal-footer">
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button variant="danger" onClick={handleLeave} loading={loading}>
              Leave Server
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
