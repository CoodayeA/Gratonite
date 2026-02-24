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
  id: string;
  label: string;
  icon: string;
  description: string;
  categories: {
    name: string;
    textChannels: string[];
    voiceChannels: string[];
  }[];
  roles: { name: string; color: string }[];
};

const SERVER_TEMPLATES: ServerTemplate[] = [
  {
    id: 'gaming',
    label: 'Gaming',
    icon: '🎮',
    description: 'Clips, match talk, and queue-up voice rooms.',
    categories: [
      { name: 'Info', textChannels: ['announcements', 'rules'], voiceChannels: [] },
      { name: 'Text', textChannels: ['general', 'lfg', 'clips-and-highlights'], voiceChannels: [] },
      { name: 'Voice', textChannels: [], voiceChannels: ['lobby', 'squad-1', 'squad-2'] },
    ],
    roles: [
      { name: 'Moderator', color: '#5865F2' },
      { name: 'Gamer', color: '#57F287' },
    ],
  },
  {
    id: 'study',
    label: 'Study Group',
    icon: '📚',
    description: 'Focused rooms for study sessions and resources.',
    categories: [
      { name: 'Info', textChannels: ['resources', 'syllabus'], voiceChannels: [] },
      { name: 'Text', textChannels: ['general', 'homework-help', 'study-tips'], voiceChannels: [] },
      { name: 'Voice', textChannels: [], voiceChannels: ['study-hall', 'break-room'] },
    ],
    roles: [
      { name: 'Tutor', color: '#EB459E' },
      { name: 'Student', color: '#FEE75C' },
    ],
  },
  {
    id: 'art',
    label: 'Art Studio',
    icon: '🎨',
    description: 'Showcase work, share WIPs, and give critiques.',
    categories: [
      { name: 'Gallery', textChannels: ['showcase', 'wip', 'critique', 'commissions'], voiceChannels: [] },
      { name: 'Hangout', textChannels: ['general'], voiceChannels: ['co-work', 'hangout'] },
    ],
    roles: [
      { name: 'Artist', color: '#E67E22' },
    ],
  },
  {
    id: 'music',
    label: 'Music Hub',
    icon: '🎵',
    description: 'Share releases, collaborate, and jam together.',
    categories: [
      { name: 'Music', textChannels: ['releases', 'production', 'collabs', 'feedback'], voiceChannels: [] },
      { name: 'Hangout', textChannels: ['general'], voiceChannels: ['listening-party', 'studio'] },
    ],
    roles: [
      { name: 'Producer', color: '#9B59B6' },
    ],
  },
  {
    id: 'creator',
    label: 'Content Creator',
    icon: '📹',
    description: 'Engage your audience with behind-the-scenes content.',
    categories: [
      { name: 'Info', textChannels: ['announcements', 'schedule'], voiceChannels: [] },
      { name: 'Community', textChannels: ['general', 'behind-the-scenes', 'fan-art'], voiceChannels: [] },
      { name: 'Voice', textChannels: [], voiceChannels: ['stream-chat', 'collab'] },
    ],
    roles: [
      { name: 'Mod', color: '#2ECC71' },
      { name: 'Subscriber', color: '#3498DB' },
    ],
  },
  {
    id: 'friends',
    label: 'Friend Group',
    icon: '👋',
    description: 'Low-pressure hangout with your crew.',
    categories: [
      { name: 'Text', textChannels: ['general', 'memes', 'plans'], voiceChannels: [] },
      { name: 'Voice', textChannels: [], voiceChannels: ['hangout', 'gaming'] },
    ],
    roles: [],
  },
  {
    id: 'dev',
    label: 'Dev Team',
    icon: '💻',
    description: 'Coordinate development across frontend, backend, and ops.',
    categories: [
      { name: 'General', textChannels: ['general', 'standups'], voiceChannels: [] },
      { name: 'Engineering', textChannels: ['frontend', 'backend', 'devops'], voiceChannels: [] },
      { name: 'Voice', textChannels: [], voiceChannels: ['standup', 'pair-programming'] },
    ],
    roles: [
      { name: 'Lead', color: '#E74C3C' },
      { name: 'Dev', color: '#1ABC9C' },
    ],
  },
  {
    id: 'blank',
    label: 'Blank',
    icon: '📝',
    description: 'Start minimal and shape channels as your group evolves.',
    categories: [
      { name: 'General', textChannels: ['general'], voiceChannels: ['voice'] },
    ],
    roles: [],
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
  const [templateId, setTemplateId] = useState('gaming');
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
      const template = SERVER_TEMPLATES.find((item) => item.id === templateId) ?? SERVER_TEMPLATES[SERVER_TEMPLATES.length - 1]!;
      const guild = await api.guilds.create({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      // Create channels from template categories
      for (const category of template.categories) {
        const cat = await api.channels.create(guild.id, {
          name: category.name,
          type: 'GUILD_CATEGORY',
        });

        for (const channelName of category.textChannels) {
          await api.channels.create(guild.id, {
            name: channelName,
            type: 'GUILD_TEXT',
            parentId: cat.id,
          });
        }

        for (const channelName of category.voiceChannels) {
          await api.channels.create(guild.id, {
            name: channelName,
            type: 'GUILD_VOICE',
            parentId: cat.id,
          });
        }
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
                <span className="create-guild-template-icon">{template.icon}</span>
                <span className="create-guild-template-title">{template.label}</span>
                <span className="create-guild-template-description">{template.description}</span>
              </button>
            ))}
          </div>
          <div className="create-guild-template-hint">
            Each template creates organized categories with text and voice channels. Customize freely after creation.
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
