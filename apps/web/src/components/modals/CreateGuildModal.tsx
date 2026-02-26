import { useState, useRef, type FormEvent } from 'react';
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
  const [step, setStep] = useState<'template' | 'details'>('template');

  // Discord import state
  const [importMode, setImportMode] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    name: string;
    categories: { name: string; channels: { name: string; type: 'text' | 'voice'; topic?: string }[] }[];
    roles: { name: string; color: string }[];
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const selectedTemplate = SERVER_TEMPLATES.find((t) => t.id === templateId) ?? SERVER_TEMPLATES[SERVER_TEMPLATES.length - 1]!;

  function handleClose() {
    setName('');
    setDescription('');
    setTemplateId('gaming');
    setError('');
    setLoading(false);
    setImportMode(false);
    setImportPreview(null);
    setImporting(false);
    setStep('template');
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

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setError('');
    setImporting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/v1/guilds/import/discord', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Import failed');
      }
      const preview = await res.json();
      setImportPreview(preview);
      setName(preview.name);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setImporting(false);
    }
  }

  async function handleConfirmImport(e: FormEvent) {
    e.preventDefault();
    if (!importPreview) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/guilds/import/discord/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim() || importPreview.name,
          categories: importPreview.categories,
          roles: importPreview.roles,
        }),
      });
      if (!res.ok) throw new Error('Import creation failed');
      const { guildId } = await res.json();

      const guildChannels = await api.channels.getGuildChannels(guildId);
      const textChannels = guildChannels.filter((channel) => channel.type === 'GUILD_TEXT');
      const landingChannel = textChannels.find((channel) => channel.name === 'general') ?? textChannels[0] ?? guildChannels[0];

      queryClient.invalidateQueries({ queryKey: ['guilds', '@me'] });
      closeModal();
      handleClose();
      if (landingChannel) {
        navigate(`/guild/${guildId}/channel/${landingChannel.id}`);
      } else {
        navigate(`/guild/${guildId}`);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal id="create-guild" title={importMode ? 'Import from Discord' : 'Create a Portal'} onClose={handleClose} size="lg">
      {importMode ? (
        <form onSubmit={handleConfirmImport} className="modal-form">
          {error && <div className="auth-error">{error}</div>}
          <input ref={importFileRef} type="file" accept=".json" hidden onChange={handleImportFile} />

          {!importPreview ? (
            <>
              <div className="discord-import-info">
                Upload a Discord server export JSON file. Your server structure (channels, categories, roles) will be recreated as a Gratonite portal.
              </div>
              <Button
                type="button"
                variant="primary"
                loading={importing}
                onClick={() => importFileRef.current?.click()}
              >
                Choose File
              </Button>
            </>
          ) : (
            <>
              <Input
                label="Portal Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />

              <div className="discord-import-preview">
                <div className="input-label">Preview</div>
                {importPreview.categories.map((cat, i) => (
                  <div key={i} className="discord-import-category">
                    <div className="discord-import-category-name">{cat.name}</div>
                    {cat.channels.map((ch, j) => (
                      <div key={j} className="discord-import-channel">
                        <span className="discord-import-channel-icon">{ch.type === 'voice' ? '#)' : '#'}</span>
                        {ch.name}
                      </div>
                    ))}
                  </div>
                ))}
                {importPreview.roles.length > 0 && (
                  <div className="discord-import-roles">
                    <div className="input-label" style={{ marginTop: 8 }}>Roles</div>
                    <div className="discord-import-roles-list">
                      {importPreview.roles.map((role, i) => (
                        <span key={i} className="discord-import-role" style={{ color: role.color }}>
                          {role.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="modal-footer">
            <Button variant="ghost" type="button" onClick={() => { setImportMode(false); setImportPreview(null); setError(''); }}>
              Back
            </Button>
            {importPreview && (
              <Button type="submit" loading={loading}>
                Create Portal
              </Button>
            )}
          </div>
        </form>
      ) : step === 'template' ? (
        <div className="modal-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="create-guild-template-group">
            <div className="input-label">Choose a Template</div>
            <p className="server-settings-muted" style={{ marginBottom: 12 }}>
              Each template creates organized categories with text and voice channels. Customize freely after creation.
            </p>
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
          </div>

          {/* Template preview */}
          <div className="channel-permission-card" style={{ marginTop: 12 }}>
            <div className="channel-permission-title">
              {selectedTemplate.icon} {selectedTemplate.label} Preview
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div className="server-settings-muted" style={{ marginBottom: 4, fontWeight: 600 }}>Channels</div>
                {selectedTemplate.categories.map((cat, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>
                    <div style={{ fontWeight: 500, fontSize: 12, opacity: 0.7, textTransform: 'uppercase' }}>{cat.name}</div>
                    {cat.textChannels.map((ch) => (
                      <div key={ch} className="server-settings-muted" style={{ paddingLeft: 12 }}># {ch}</div>
                    ))}
                    {cat.voiceChannels.map((ch) => (
                      <div key={ch} className="server-settings-muted" style={{ paddingLeft: 12 }}>#) {ch}</div>
                    ))}
                  </div>
                ))}
              </div>
              {selectedTemplate.roles.length > 0 && (
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div className="server-settings-muted" style={{ marginBottom: 4, fontWeight: 600 }}>Roles</div>
                  {selectedTemplate.roles.map((role) => (
                    <div key={role.name} className="server-settings-stat-pill" style={{ color: role.color, marginBottom: 4 }}>
                      @{role.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="discord-import-link"
              onClick={() => setImportMode(true)}
            >
              Or import from Discord
            </button>
            <div style={{ flex: 1 }} />
            <Button variant="ghost" type="button" onClick={() => { closeModal(); handleClose(); }}>
              Cancel
            </Button>
            <Button type="button" onClick={() => setStep('details')}>
              Next
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="server-settings-inline-stats" style={{ marginBottom: 8 }}>
            <span className="server-settings-stat-pill">
              {selectedTemplate.icon} {selectedTemplate.label}
            </span>
            <button type="button" className="channel-permission-remove" onClick={() => setStep('template')}>
              Change Template
            </button>
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
            <Button variant="ghost" type="button" onClick={() => setStep('template')}>
              Back
            </Button>
            <Button type="submit" loading={loading} disabled={!name.trim()}>
              Create Portal
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
