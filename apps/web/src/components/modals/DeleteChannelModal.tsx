import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUiStore } from '@/stores/ui.store';
import { useChannelsStore } from '@/stores/channels.store';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

const GUILD_CATEGORY = 'GUILD_CATEGORY';
const TEXT_TYPES = new Set(['GUILD_TEXT', 'GUILD_ANNOUNCEMENT', 'GUILD_FORUM']);

export function DeleteChannelModal() {
  const closeModal = useUiStore((s) => s.closeModal);
  const modalData = useUiStore((s) => s.modalData);
  const removeChannel = useChannelsStore((s) => s.removeChannel);
  const channels = useChannelsStore((s) => s.channels);
  const channelsByGuild = useChannelsStore((s) => s.channelsByGuild);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const channelId = (modalData?.['channelId'] as string | undefined) ?? '';
  const channel = channelId ? channels.get(channelId) : undefined;
  const guildId = channel?.guildId ?? ((modalData?.['guildId'] as string | undefined) ?? '');

  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const nameMatches = Boolean(channel?.name) && confirmText.trim() === channel?.name;

  const fallbackChannelId = useMemo(() => {
    if (!guildId) return null;
    const ids = channelsByGuild.get(guildId) ?? [];
    const candidates = ids
      .filter((id) => id !== channelId)
      .map((id) => channels.get(id))
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .filter((item) => item.type !== GUILD_CATEGORY)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const preferredText = candidates.find((item) => TEXT_TYPES.has(item.type));
    return (preferredText ?? candidates[0])?.id ?? null;
  }, [guildId, channelsByGuild, channels, channelId]);

  async function handleDelete() {
    if (!channelId || !guildId || !nameMatches) return;
    setLoading(true);
    setError('');

    try {
      await api.channels.delete(channelId);
      removeChannel(channelId);
      queryClient.invalidateQueries({ queryKey: ['channels', guildId] });
      closeModal();

      if (fallbackChannelId) {
        navigate(`/guild/${guildId}/channel/${fallbackChannelId}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal id="delete-channel" title={`Delete #${channel?.name ?? 'channel'}`} size="sm">
      <p>
        Deleting <strong>#{channel?.name ?? 'this channel'}</strong> permanently removes its message history.
        This action cannot be undone.
      </p>

      <Input
        label="Type the channel name to confirm"
        value={confirmText}
        onChange={(event) => setConfirmText(event.target.value)}
        placeholder={channel?.name ?? 'channel-name'}
      />

      {error && <div className="auth-error" style={{ marginTop: '12px' }}>{error}</div>}

      <div className="modal-footer">
        <Button variant="ghost" onClick={closeModal}>Cancel</Button>
        <Button variant="danger" onClick={handleDelete} loading={loading} disabled={!nameMatches}>
          Delete Channel
        </Button>
      </div>
    </Modal>
  );
}
