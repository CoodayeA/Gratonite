import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUiStore } from '@/stores/ui.store';
import { useChannelsStore } from '@/stores/channels.store';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { PermissionFlags, type Channel } from '@gratonite/types';

const GUILD_TEXT = 'GUILD_TEXT';
const GUILD_VOICE = 'GUILD_VOICE';
const GUILD_CATEGORY = 'GUILD_CATEGORY';
const GUILD_STAGE_VOICE = 'GUILD_STAGE_VOICE';

const CHANNEL_TYPE_OPTIONS = [
  { value: GUILD_TEXT, label: 'Text', icon: '#', description: 'Send messages, images, and files' },
  { value: GUILD_VOICE, label: 'Voice', icon: '#)', description: 'Hang out with voice and video' },
  { value: GUILD_STAGE_VOICE, label: 'Stage', icon: '\u{1F399}', description: 'Host events with speakers and audience' },
  { value: GUILD_CATEGORY, label: 'Category', icon: '\u{1F4C1}', description: 'Organize channels into groups' },
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
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as CSSProperties,
  inputLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#a8a4b8',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  } as CSSProperties,
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  } as CSSProperties,
  typeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '10px 12px',
    minHeight: 'auto',
    background: '#25243a',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: '#4a4660',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'border-color 0.15s, background 0.15s',
  } as CSSProperties,
  typeCardActive: {
    borderColor: '#d4af37',
    background: 'rgba(212, 175, 55, 0.08)',
  } as CSSProperties,
  typeIcon: {
    fontSize: 18,
    lineHeight: 1,
  } as CSSProperties,
  typeTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e8e4e0',
  } as CSSProperties,
  typeDescription: {
    fontSize: 11,
    color: '#a8a4b8',
    lineHeight: 1.3,
  } as CSSProperties,
  selectField: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    color: '#e8e4e0',
    background: '#25243a',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
    appearance: 'none',
    cursor: 'pointer',
  } as CSSProperties,
  textareaField: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    color: '#e8e4e0',
    background: '#25243a',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.4,
  } as CSSProperties,
  privateToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    color: '#e8e4e0',
    cursor: 'pointer',
  } as CSSProperties,
  privateNote: {
    fontSize: 12,
    color: '#6e6a80',
    margin: 0,
    marginTop: -8,
  } as CSSProperties,
  footer: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  } as CSSProperties,
};

export function CreateChannelModal() {
  const activeModal = useUiStore((s) => s.activeModal);
  const modalData = useUiStore((s) => s.modalData);
  const closeModal = useUiStore((s) => s.closeModal);
  const addChannel = useChannelsStore((s) => s.addChannel);
  const navigate = useNavigate();

  const guildId = (modalData?.['guildId'] as string | undefined) ?? undefined;
  const defaultParentId = (modalData?.['parentId'] as string | undefined) ?? '';
  const defaultType = (modalData?.['type'] as string | undefined) ?? GUILD_TEXT;

  const channels = useChannelsStore((s) => s.channels);
  const channelIds = useChannelsStore((s) =>
    guildId ? s.channelsByGuild.get(guildId) ?? [] : [],
  );

  const categories = useMemo(() =>
    channelIds
      .map((id) => channels.get(id))
      .filter((ch): ch is Channel => {
        if (!ch) return false;
        return ch.type === GUILD_CATEGORY;
      }),
  [channelIds, channels]);

  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState(GUILD_TEXT);
  const [parentId, setParentId] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const wasOpenRef = useRef(false);

  function resetForm(nextParentId = '', nextType = GUILD_TEXT) {
    setName('');
    setTopic('');
    setType(nextType);
    setParentId(nextParentId);
    setIsPrivate(false);
    setError('');
    setLoading(false);
  }

  useEffect(() => {
    if (activeModal !== 'create-channel') {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    resetForm(defaultParentId, defaultType);
  }, [activeModal, defaultParentId, defaultType]);

  function handleClose() {
    closeModal();
    resetForm();
  }

  const isNotCategory = type !== GUILD_CATEGORY;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!guildId || !name.trim()) return;
    setError('');
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        parentId: type === GUILD_CATEGORY ? undefined : parentId || undefined,
        topic: type === GUILD_CATEGORY ? undefined : (topic.trim() || undefined),
      };
      const channel = await api.channels.create(guildId, payload);

      if (isPrivate && type !== GUILD_CATEGORY) {
        const roles = await api.guilds.getRoles(guildId);
        const everyoneRole = roles.find((role) => role.name === '@everyone');
        if (everyoneRole) {
          await api.channels.setPermissionOverride(channel.id, everyoneRole.id, {
            targetType: 'role',
            allow: '0',
            deny: PermissionFlags.VIEW_CHANNEL.toString(),
          });
        }
      }

      addChannel(channel);
      handleClose();
      if (type !== GUILD_CATEGORY) {
        navigate(`/guild/${guildId}/channel/${channel.id}`);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal id="create-channel" title="Create Channel" onClose={resetForm} size="sm">
      <form style={styles.form} onSubmit={handleSubmit}>
        {error && <div style={styles.error}>{error}</div>}

        {/* Channel type picker */}
        <div style={styles.inputGroup}>
          <label style={styles.inputLabel}>Channel Type</label>
          <div style={styles.typeGrid}>
            {CHANNEL_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                style={{
                  ...styles.typeCard,
                  ...(type === opt.value ? styles.typeCardActive : {}),
                }}
                onClick={() => setType(opt.value)}
              >
                <span style={styles.typeIcon}>{opt.icon}</span>
                <span style={styles.typeTitle}>{opt.label}</span>
                <span style={styles.typeDescription}>{opt.description}</span>
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Channel Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === GUILD_CATEGORY ? 'Category name' : 'general'}
          maxLength={100}
          required
          autoFocus
        />

        {isNotCategory && (
          <div style={styles.inputGroup}>
            <label style={styles.inputLabel}>Category</label>
            <select
              style={styles.selectField}
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">No Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        )}

        {isNotCategory && (
          <div style={styles.inputGroup}>
            <label style={styles.inputLabel}>Topic</label>
            <textarea
              style={styles.textareaField}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What is this channel for?"
              maxLength={1024}
              rows={3}
            />
          </div>
        )}

        {isNotCategory && (
          <label style={styles.privateToggle}>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(event) => setIsPrivate(event.target.checked)}
            />
            <span>Private channel</span>
          </label>
        )}

        {isNotCategory && (
          <p style={styles.privateNote}>
            Only members with explicit permissions can view this channel.
          </p>
        )}

        <div style={styles.footer}>
          <Button variant="ghost" type="button" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={loading} disabled={!name.trim() || !guildId}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}
