import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useUiStore } from '@/stores/ui.store';
import { getErrorMessage } from '@/lib/utils';

interface EmojiSectionProps {
  guildId: string;
}

export function EmojiSection({ guildId }: EmojiSectionProps) {
  const openModal = useUiStore((s) => s.openModal);
  const queryClient = useQueryClient();

  const [error, setError] = useState('');
  const [deletingEmojiId, setDeletingEmojiId] = useState<string | null>(null);

  const { data: emojis = [], isLoading } = useQuery({
    queryKey: ['guild-emojis', guildId],
    queryFn: () => api.guilds.getEmojis(guildId),
    enabled: Boolean(guildId),
  });

  const animated = emojis.filter((emoji) => emoji.animated).length;
  const staticCount = emojis.length - animated;

  async function handleDeleteEmoji(emojiId: string) {
    setError('');
    setDeletingEmojiId(emojiId);
    try {
      await api.guilds.deleteEmoji(guildId, emojiId);
      await queryClient.invalidateQueries({ queryKey: ['guild-emojis', guildId] });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingEmojiId(null);
    }
  }

  return (
    <section className="settings-section">
      <div className="server-settings-header-row">
        <div>
          <h2 className="settings-shell-section-heading">Emoji</h2>
          <p className="server-settings-muted">Upload and manage custom portal emojis.</p>
        </div>
        <Button onClick={() => openModal('emoji-studio', { guildId })} disabled={!guildId}>
          Upload Emoji
        </Button>
      </div>

      {error && <div className="modal-error">{error}</div>}

      <div className="emoji-slot-summary">
        <div className="emoji-slot-card">
          <span className="emoji-slot-label">Static</span>
          <span className="emoji-slot-value">{staticCount}/50</span>
        </div>
        <div className="emoji-slot-card">
          <span className="emoji-slot-label">Animated</span>
          <span className="emoji-slot-value">{animated}/50</span>
        </div>
      </div>

      {isLoading && <div className="server-settings-muted">Loading emojis...</div>}
      {!isLoading && emojis.length === 0 && (
        <div className="server-settings-muted">No custom emojis yet.</div>
      )}

      {!isLoading && emojis.length > 0 && (
        <div className="emoji-admin-grid">
          {emojis.map((emoji) => (
            <div key={emoji.id} className="emoji-admin-item">
              <img src={emoji.url} alt={emoji.name} className="emoji-admin-preview" />
              <div className="emoji-admin-meta">
                <span className="emoji-admin-name">:{emoji.name}:</span>
                {emoji.animated && <span className="emoji-admin-badge">GIF</span>}
              </div>
              <button
                type="button"
                className="emoji-admin-delete"
                onClick={() => handleDeleteEmoji(emoji.id)}
                disabled={deletingEmojiId === emoji.id}
              >
                {deletingEmojiId === emoji.id ? 'Removing...' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
