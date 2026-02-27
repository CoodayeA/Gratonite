import { useState, useRef, type CSSProperties, type FormEvent } from 'react';
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
    icon: '\u{1F3AE}',
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
    icon: '\u{1F4DA}',
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
    icon: '\u{1F3A8}',
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
    icon: '\u{1F3B5}',
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
    icon: '\u{1F4F9}',
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
    icon: '\u{1F44B}',
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
    icon: '\u{1F4BB}',
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
    icon: '\u{1F4DD}',
    description: 'Start minimal and shape channels as your group evolves.',
    categories: [
      { name: 'General', textChannels: ['general'], voiceChannels: ['voice'] },
    ],
    roles: [],
  },
];

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  } as CSSProperties,
  error: {
    color: '#f04747',
    fontSize: 13,
    padding: '8px 12px',
    background: 'rgba(240, 71, 71, 0.1)',
    borderRadius: 'var(--radius-sm)',
  } as CSSProperties,
  inputLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#a8a4b8',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  } as CSSProperties,
  mutedText: {
    fontSize: 13,
    color: '#a8a4b8',
    margin: 0,
    marginBottom: 12,
  } as CSSProperties,
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
  } as CSSProperties,
  templateCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '14px 10px',
    minHeight: 100,
    background: '#25243a',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: '#4a4660',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'border-color 0.15s, background 0.15s',
  } as CSSProperties,
  templateCardActive: {
    borderColor: '#d4af37',
    background: 'rgba(212, 175, 55, 0.08)',
  } as CSSProperties,
  templateIcon: {
    fontSize: 24,
    lineHeight: 1,
  } as CSSProperties,
  templateTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e8e4e0',
  } as CSSProperties,
  templateDescription: {
    fontSize: 11,
    color: '#a8a4b8',
    lineHeight: 1.3,
  } as CSSProperties,
  previewCard: {
    background: '#353348',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-md)',
    padding: 16,
    marginTop: 12,
  } as CSSProperties,
  previewTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#e8e4e0',
    marginBottom: 12,
  } as CSSProperties,
  previewColumns: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
  } as CSSProperties,
  previewColumn: {
    flex: 1,
    minWidth: 180,
  } as CSSProperties,
  previewColumnSmall: {
    flex: 1,
    minWidth: 120,
  } as CSSProperties,
  previewSectionLabel: {
    fontSize: 13,
    color: '#a8a4b8',
    marginBottom: 4,
    fontWeight: 600,
  } as CSSProperties,
  previewCategoryName: {
    fontWeight: 500,
    fontSize: 12,
    opacity: 0.7,
    textTransform: 'uppercase',
    color: '#e8e4e0',
  } as CSSProperties,
  previewChannel: {
    fontSize: 13,
    color: '#a8a4b8',
    paddingLeft: 12,
  } as CSSProperties,
  previewCategoryBlock: {
    marginBottom: 4,
  } as CSSProperties,
  rolePill: {
    display: 'inline-block',
    fontSize: 12,
    padding: '2px 8px',
    background: '#413d58',
    borderRadius: 10,
    marginBottom: 4,
  } as CSSProperties,
  footer: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 16,
  } as CSSProperties,
  importLink: {
    background: 'none',
    border: 'none',
    color: '#a8a4b8',
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
  } as CSSProperties,
  spacer: {
    flex: 1,
  } as CSSProperties,
  templateBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  } as CSSProperties,
  templateBadge: {
    display: 'inline-block',
    fontSize: 12,
    padding: '4px 10px',
    background: '#413d58',
    borderRadius: 10,
    color: '#e8e4e0',
  } as CSSProperties,
  changeTemplateBtn: {
    background: 'none',
    border: 'none',
    color: '#a8a4b8',
    fontSize: 12,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  } as CSSProperties,
  importInfo: {
    fontSize: 13,
    color: '#a8a4b8',
    lineHeight: 1.5,
  } as CSSProperties,
  importPreview: {
    background: '#25243a',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-md)',
    padding: 12,
  } as CSSProperties,
  importCategoryName: {
    fontSize: 12,
    fontWeight: 600,
    color: '#e8e4e0',
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 8,
  } as CSSProperties,
  importChannel: {
    fontSize: 13,
    color: '#a8a4b8',
    paddingLeft: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  } as CSSProperties,
  importChannelIcon: {
    color: '#6e6a80',
    fontSize: 13,
    fontWeight: 600,
  } as CSSProperties,
  importRolesSection: {
    marginTop: 8,
  } as CSSProperties,
  importRolesList: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  } as CSSProperties,
  importRole: {
    fontSize: 12,
    padding: '2px 8px',
    background: '#353348',
    borderRadius: 10,
  } as CSSProperties,
};

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
        <form onSubmit={handleConfirmImport} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}
          <input ref={importFileRef} type="file" accept=".json" hidden onChange={handleImportFile} />

          {!importPreview ? (
            <>
              <div style={styles.importInfo}>
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

              <div style={styles.importPreview}>
                <div style={styles.inputLabel}>Preview</div>
                {importPreview.categories.map((cat, i) => (
                  <div key={i}>
                    <div style={styles.importCategoryName}>{cat.name}</div>
                    {cat.channels.map((ch, j) => (
                      <div key={j} style={styles.importChannel}>
                        <span style={styles.importChannelIcon}>{ch.type === 'voice' ? '#)' : '#'}</span>
                        {ch.name}
                      </div>
                    ))}
                  </div>
                ))}
                {importPreview.roles.length > 0 && (
                  <div style={styles.importRolesSection}>
                    <div style={{ ...styles.inputLabel, marginTop: 8 }}>Roles</div>
                    <div style={styles.importRolesList}>
                      {importPreview.roles.map((role, i) => (
                        <span key={i} style={{ ...styles.importRole, color: role.color }}>
                          {role.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div style={styles.footer}>
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
        <div style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}

          <div>
            <div style={styles.inputLabel}>Choose a Template</div>
            <p style={styles.mutedText}>
              Each template creates organized categories with text and voice channels. Customize freely after creation.
            </p>
            <div style={styles.templateGrid}>
              {SERVER_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  style={{
                    ...styles.templateCard,
                    ...(templateId === template.id ? styles.templateCardActive : {}),
                  }}
                  onClick={() => setTemplateId(template.id)}
                >
                  <span style={styles.templateIcon}>{template.icon}</span>
                  <span style={styles.templateTitle}>{template.label}</span>
                  <span style={styles.templateDescription}>{template.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Template preview */}
          <div style={styles.previewCard}>
            <div style={styles.previewTitle}>
              {selectedTemplate.icon} {selectedTemplate.label} Preview
            </div>
            <div style={styles.previewColumns}>
              <div style={styles.previewColumn}>
                <div style={styles.previewSectionLabel}>Channels</div>
                {selectedTemplate.categories.map((cat, i) => (
                  <div key={i} style={styles.previewCategoryBlock}>
                    <div style={styles.previewCategoryName as CSSProperties}>{cat.name}</div>
                    {cat.textChannels.map((ch) => (
                      <div key={ch} style={styles.previewChannel}># {ch}</div>
                    ))}
                    {cat.voiceChannels.map((ch) => (
                      <div key={ch} style={styles.previewChannel}>#) {ch}</div>
                    ))}
                  </div>
                ))}
              </div>
              {selectedTemplate.roles.length > 0 && (
                <div style={styles.previewColumnSmall}>
                  <div style={styles.previewSectionLabel}>Roles</div>
                  {selectedTemplate.roles.map((role) => (
                    <div key={role.name} style={{ ...styles.rolePill, color: role.color, marginBottom: 4 }}>
                      @{role.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={styles.footer}>
            <button
              type="button"
              style={styles.importLink}
              onClick={() => setImportMode(true)}
            >
              Or import from Discord
            </button>
            <div style={styles.spacer} />
            <Button variant="ghost" type="button" onClick={() => { closeModal(); handleClose(); }}>
              Cancel
            </Button>
            <Button type="button" onClick={() => setStep('details')}>
              Next
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.templateBadgeRow}>
            <span style={styles.templateBadge}>
              {selectedTemplate.icon} {selectedTemplate.label}
            </span>
            <button type="button" style={styles.changeTemplateBtn} onClick={() => setStep('template')}>
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

          <div style={styles.footer}>
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
