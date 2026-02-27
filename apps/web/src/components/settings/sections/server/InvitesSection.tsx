import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
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
  permissionCard: {
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(10, 16, 28, 0.66)',
    padding: 10,
    display: 'grid',
    gap: 8,
  } as React.CSSProperties,
  permissionTitle: {
    fontSize: 12,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as React.CSSProperties,
  inputLabel: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  inputField: {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
  } as React.CSSProperties,
  inlineStats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  } as React.CSSProperties,
  statPill: {
    fontSize: 11,
    color: 'var(--text-muted)',
    border: '1px solid var(--stroke)',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 'var(--radius-pill)',
    padding: '4px 8px',
    fontFamily: 'monospace',
    userSelect: 'all',
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  feedback: {
    fontSize: 12,
    color: 'var(--text-muted)',
    border: '1px solid color-mix(in srgb, var(--stroke) 88%, transparent)',
    borderRadius: 10,
    background: 'rgba(255, 255, 255, 0.02)',
    padding: '6px 8px',
    lineHeight: 1.35,
  } as React.CSSProperties,
};

interface InvitesSectionProps {
  guildId: string;
}

export function InvitesSection({ guildId }: InvitesSectionProps) {
  const [error, setError] = useState('');
  const [channelId, setChannelId] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');

  const { data: channels = [] } = useQuery({
    queryKey: ['guild-channels', guildId],
    queryFn: () => api.channels.getGuildChannels(guildId),
    enabled: Boolean(guildId),
  });

  const textChannels = (Array.isArray(channels) ? channels : []).filter((c) => c.type === 'GUILD_TEXT');

  async function handleGenerateInvite() {
    if (!channelId) return;
    setError('');
    setGenerating(true);
    try {
      const result = await api.invites.create(guildId, { channelId });
      setGeneratedCode(result.code);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopyInvite() {
    if (!generatedCode) return;
    const link = `${window.location.origin}/invite/${generatedCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopyFeedback('Invite link copied!');
      setTimeout(() => setCopyFeedback(''), 2200);
    } catch {
      setCopyFeedback('Failed to copy.');
      setTimeout(() => setCopyFeedback(''), 2200);
    }
  }

  return (
    <section style={styles.section}>
      <h2 style={styles.heading}>Invites</h2>
      <p style={styles.muted}>Generate an invite link for this portal.</p>

      {error && <div style={styles.modalError}>{error}</div>}

      <div style={{ ...styles.permissionCard, marginBottom: 12 }}>
        <div style={styles.permissionTitle}>Create Invite Link</div>
        <div style={{ ...styles.inputGroup, marginBottom: 8 }}>
          <label style={styles.inputLabel}>Channel</label>
          <select
            style={styles.inputField}
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            disabled={generating}
          >
            <option value="">Select a channel</option>
            {textChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                #{channel.name}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={handleGenerateInvite} disabled={!channelId || generating} loading={generating}>
          Generate Invite
        </Button>
      </div>

      {generatedCode && (
        <div style={styles.permissionCard}>
          <div style={styles.permissionTitle}>Invite Link</div>
          <div style={{ ...styles.inlineStats, marginBottom: 8 }}>
            <code style={styles.statPill}>
              {window.location.origin}/invite/{generatedCode}
            </code>
          </div>
          <div style={styles.actions}>
            <Button variant="ghost" onClick={handleCopyInvite}>
              Copy Link
            </Button>
          </div>
          {copyFeedback && (
            <div style={styles.feedback} role="status" aria-live="polite">
              {copyFeedback}
            </div>
          )}
        </div>
      )}

      {textChannels.length === 0 && (
        <div style={styles.muted}>No text channels available. Create a text channel first.</div>
      )}
    </section>
  );
}
