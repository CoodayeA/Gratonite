import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { api } from '@/lib/api';
import { useUiStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { getErrorMessage } from '@/lib/utils';

export function InviteModal() {
  const activeModal = useUiStore((s) => s.activeModal);
  const currentGuildId = useGuildsStore((s) => s.currentGuildId);
  const currentChannelId = useChannelsStore((s) => s.currentChannelId);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Auto-generate invite on open
  useEffect(() => {
    if (activeModal !== 'invite' || !currentGuildId || !currentChannelId) return;

    setLoading(true);
    setError('');
    setInviteCode(null);
    setCopied(false);

    api.invites
      .create(currentGuildId, {
        channelId: currentChannelId,
        maxAgeSeconds: 86400, // 24 hours
      })
      .then((result) => {
        setInviteCode(result.code);
      })
      .catch((err) => {
        setError(getErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [activeModal, currentGuildId, currentChannelId]);

  function handleClose() {
    setInviteCode(null);
    setError('');
    setCopied(false);
  }

  function copyLink() {
    if (!inviteCode) return;
    const url = `${window.location.origin}/invite/${inviteCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Modal id="invite" title="Invite People" size="sm" onClose={handleClose}>
      {error && <div className="auth-error">{error}</div>}

      {loading && !inviteCode && (
        <div className="invite-modal-loading">
          <LoadingSpinner size={24} />
          <span>Generating invite link...</span>
        </div>
      )}

      {inviteCode && (
        <div className="invite-link-group">
          <input
            className="input-field invite-link-input"
            value={`${window.location.origin}/invite/${inviteCode}`}
            readOnly
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button onClick={copyLink} size="sm">
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      )}

      <p className="invite-link-hint">
        This invite expires in 24 hours.
      </p>
    </Modal>
  );
}
