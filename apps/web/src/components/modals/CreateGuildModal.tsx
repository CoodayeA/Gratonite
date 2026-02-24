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

type ServerTemplate = {
  id: 'gaming' | 'study' | 'chill' | 'creative' | 'custom';
  label: string;
  description: string;
  textChannels: string[];
  voiceChannels: string[];
};

const SERVER_TEMPLATES: ServerTemplate[] = [
  {
    id: 'gaming',
    label: 'Gaming',
    description: 'Clips, match talk, and queue-up voice rooms.',
    textChannels: ['game-talk', 'clips-and-highlights'],
    voiceChannels: ['lobby', 'gaming'],
  },
  {
    id: 'study',
    label: 'Study',
    description: 'Focused rooms for study sessions and resources.',
    textChannels: ['resources', 'assignments'],
    voiceChannels: ['study-hall', 'break-room'],
  },
  {
    id: 'chill',
    label: 'Chill',
    description: 'Low-pressure hangout with light conversation.',
    textChannels: ['media-share', 'daily-chat'],
    voiceChannels: ['hangout', 'music-room'],
  },
  {
    id: 'creative',
    label: 'Creative',
    description: 'Show work, trade feedback, and co-create.',
    textChannels: ['show-and-tell', 'project-lab'],
    voiceChannels: ['co-work', 'critique'],
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Start minimal and shape channels as your group evolves.',
    textChannels: ['chat'],
    voiceChannels: ['voice'],
  },
];

export function CreateGuildModal() {
  const closeModal = useUiStore((s) => s.closeModal);
  const openModal = useUiStore((s) => s.openModal);
  const addGuild = useGuildsStore((s) => s.addGuild);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState<ServerTemplate['id']>('gaming');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleClose() {
    setName('');
    setDescription('');
    setTemplateId('gaming');
    setError('');
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setLoading(true);

    try {
      const template = SERVER_TEMPLATES.find((item) => item.id === templateId) ?? SERVER_TEMPLATES[0]!;
      const guild = await api.guilds.create({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      for (const channelName of template.textChannels) {
        await api.channels.create(guild.id, {
          name: channelName,
          type: 'GUILD_TEXT',
        });
      }

      for (const channelName of template.voiceChannels) {
        await api.channels.create(guild.id, {
          name: channelName,
          type: 'GUILD_VOICE',
        });
      }

      const guildChannels = await api.channels.getGuildChannels(guild.id);
      const textChannels = guildChannels.filter((channel) => channel.type === 'GUILD_TEXT');
      const landingChannel = textChannels.find((channel) => channel.name === 'general') ?? textChannels[0] ?? guildChannels[0];
      if (!landingChannel) {
        throw new Error('Could not resolve a starter channel for the new portal.');
      }

      const invite = await api.invites.create(guild.id, {
        channelId: landingChannel.id,
        maxAgeSeconds: 86400,
      });

      addGuild(guild);
      queryClient.invalidateQueries({ queryKey: ['guilds', '@me'] });
      queryClient.invalidateQueries({ queryKey: ['channels', guild.id] });
      closeModal();
      handleClose();
      navigate(`/guild/${guild.id}/channel/${landingChannel.id}`);
      setTimeout(() => {
        openModal('invite', {
          guildId: guild.id,
          channelId: landingChannel.id,
          inviteCode: invite.code,
        });
      }, 0);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal id="create-guild" title="Create a Portal" onClose={handleClose}>
      <form onSubmit={handleSubmit} className="modal-form">
        {error && <div className="auth-error">{error}</div>}

        <div className="create-guild-template-group">
          <div className="input-label">Template</div>
          <div className="create-guild-template-grid">
            {SERVER_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`create-guild-template-card ${templateId === template.id ? 'create-guild-template-card-active' : ''}`}
                onClick={() => setTemplateId(template.id)}
              >
                <span className="create-guild-template-title">{template.label}</span>
                <span className="create-guild-template-description">{template.description}</span>
              </button>
            ))}
          </div>
          <div className="create-guild-template-hint">
            Starter layout stays intentionally small so your channels can grow based on real usage.
          </div>
        </div>

        <Input
          label="Portal Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          maxLength={100}
          placeholder="My Awesome Portal"
        />

        <Input
          label="Description (optional)"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          placeholder="What is this portal about?"
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
