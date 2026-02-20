import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { useUiStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { getErrorMessage } from '@/lib/utils';

export function CreateGuildModal() {
  const closeModal = useUiStore((s) => s.closeModal);
  const addGuild = useGuildsStore((s) => s.addGuild);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleClose() {
    setName('');
    setDescription('');
    setError('');
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setLoading(true);

    try {
      const guild = await api.guilds.create({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      addGuild(guild);
      queryClient.invalidateQueries({ queryKey: ['guilds', '@me'] });
      closeModal();
      handleClose();
      navigate(`/guild/${guild.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal id="create-guild" title="Create a Server" onClose={handleClose}>
      <form onSubmit={handleSubmit} className="modal-form">
        {error && <div className="auth-error">{error}</div>}

        <Input
          label="Server Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          maxLength={100}
          placeholder="My Awesome Server"
        />

        <Input
          label="Description (optional)"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          placeholder="What is this server about?"
        />

        <div className="modal-footer">
          <Button variant="ghost" type="button" onClick={() => { closeModal(); handleClose(); }}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
