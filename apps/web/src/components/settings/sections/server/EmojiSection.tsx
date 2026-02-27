import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useUiStore } from '@/stores/ui.store';
import { getErrorMessage } from '@/lib/utils';

const styles = {
  section: {
    maxWidth: 720,
  } as React.CSSProperties,
  heading: {
    fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 4,
  } as React.CSSProperties,
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  } as React.CSSProperties,
  muted: {
    fontSize: 13,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  modalError: {
    padding: '10px 14px',
    background: 'var(--danger-bg)',
    border: '1px solid rgba(255, 107, 107, 0.25)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger)',
    fontSize: 13,
  } as React.CSSProperties,
  slotSummary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  } as React.CSSProperties,
  slotCard: {
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(10, 16, 28, 0.66)',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,
  slotLabel: {
    color: 'var(--text-muted)',
    fontSize: 12,
  } as React.CSSProperties,
  slotValue: {
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 700,
  } as React.CSSProperties,
  adminGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 10,
  } as React.CSSProperties,
  adminItem: {
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(10, 16, 28, 0.62)',
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  } as React.CSSProperties,
  adminPreview: {
    width: 40,
    height: 40,
    objectFit: 'contain',
  } as React.CSSProperties,
  adminMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  } as React.CSSProperties,
  adminName: {
    fontSize: 12,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  adminBadge: {
    fontSize: 10,
    color: 'var(--accent)',
    border: '1px solid rgba(212, 175, 55, 0.35)',
    borderRadius: 'var(--radius-pill)',
    padding: '2px 6px',
  } as React.CSSProperties,
  adminDelete: {
    border: '1px solid rgba(255, 107, 107, 0.35)',
    background: 'rgba(255, 107, 107, 0.12)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius-md)',
    fontSize: 12,
    padding: '6px 8px',
    cursor: 'pointer',
  } as React.CSSProperties,
};

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
    <section style={styles.section}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.heading}>Emoji</h2>
          <p style={styles.muted}>Upload and manage custom portal emojis.</p>
        </div>
        <Button onClick={() => openModal('emoji-studio', { guildId })} disabled={!guildId}>
          Upload Emoji
        </Button>
      </div>

      {error && <div style={styles.modalError}>{error}</div>}

      <div style={styles.slotSummary}>
        <div style={styles.slotCard}>
          <span style={styles.slotLabel}>Static</span>
          <span style={styles.slotValue}>{staticCount}/50</span>
        </div>
        <div style={styles.slotCard}>
          <span style={styles.slotLabel}>Animated</span>
          <span style={styles.slotValue}>{animated}/50</span>
        </div>
      </div>

      {isLoading && <div style={styles.muted}>Loading emojis...</div>}
      {!isLoading && emojis.length === 0 && (
        <div style={styles.muted}>No custom emojis yet.</div>
      )}

      {!isLoading && emojis.length > 0 && (
        <div style={styles.adminGrid}>
          {emojis.map((emoji) => (
            <div key={emoji.id} style={styles.adminItem}>
              <img src={emoji.url} alt={emoji.name} style={styles.adminPreview} />
              <div style={styles.adminMeta}>
                <span style={styles.adminName}>:{emoji.name}:</span>
                {emoji.animated && <span style={styles.adminBadge}>GIF</span>}
              </div>
              <button
                type="button"
                style={styles.adminDelete}
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
