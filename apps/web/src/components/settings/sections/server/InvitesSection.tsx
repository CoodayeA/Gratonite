import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

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

  const textChannels = channels.filter((c) => c.type === 'GUILD_TEXT');

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
    <section className="settings-section">
      <h2 className="settings-shell-section-heading">Invites</h2>
      <p className="server-settings-muted">Generate an invite link for this portal.</p>

      {error && <div className="modal-error">{error}</div>}

      <div className="channel-permission-card" style={{ marginBottom: 12 }}>
        <div className="channel-permission-title">Create Invite Link</div>
        <div className="input-group" style={{ marginBottom: 8 }}>
          <label className="input-label">Channel</label>
          <select
            className="input-field"
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
        <div className="channel-permission-card">
          <div className="channel-permission-title">Invite Link</div>
          <div className="server-settings-inline-stats" style={{ marginBottom: 8 }}>
            <code className="server-settings-stat-pill" style={{ fontFamily: 'monospace', userSelect: 'all' }}>
              {window.location.origin}/invite/{generatedCode}
            </code>
          </div>
          <div className="server-settings-actions">
            <Button variant="ghost" onClick={handleCopyInvite}>
              Copy Link
            </Button>
          </div>
          {copyFeedback && (
            <div className="server-settings-feedback" role="status" aria-live="polite">
              {copyFeedback}
            </div>
          )}
        </div>
      )}

      {textChannels.length === 0 && (
        <div className="server-settings-muted">No text channels available. Create a text channel first.</div>
      )}
    </section>
  );
}
