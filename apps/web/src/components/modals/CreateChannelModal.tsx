import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
  { value: GUILD_STAGE_VOICE, label: 'Stage', icon: '🎙', description: 'Host events with speakers and audience' },
  { value: GUILD_CATEGORY, label: 'Category', icon: '📁', description: 'Organize channels into groups' },
];

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
      <form className="modal-form" onSubmit={handleSubmit}>
        {error && <div className="modal-error">{error}</div>}

        {/* Channel type picker */}
        <div className="input-group">
          <label className="input-label">Channel Type</label>
          <div className="create-guild-template-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {CHANNEL_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`create-guild-template-card ${type === opt.value ? 'create-guild-template-card-active' : ''}`}
                onClick={() => setType(opt.value)}
                style={{ padding: '10px 12px', minHeight: 'auto' }}
              >
                <span className="create-guild-template-icon" style={{ fontSize: 18 }}>{opt.icon}</span>
                <span className="create-guild-template-title" style={{ fontSize: 13 }}>{opt.label}</span>
                <span className="create-guild-template-description" style={{ fontSize: 11 }}>{opt.description}</span>
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
          <div className="input-group">
            <label className="input-label">Category</label>
            <div className="input-wrapper">
              <select
                className="input-field"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">No Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {isNotCategory && (
          <div className="input-group">
            <label className="input-label">Topic</label>
            <div className="input-wrapper">
              <textarea
                className="input-field channel-topic-input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What is this channel for?"
                maxLength={1024}
                rows={3}
              />
            </div>
          </div>
        )}

        {isNotCategory && (
          <label className="channel-private-toggle">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(event) => setIsPrivate(event.target.checked)}
            />
            <span>Private channel</span>
          </label>
        )}

        {isNotCategory && (
          <p className="channel-private-note">
            Only members with explicit permissions can view this channel.
          </p>
        )}

        <div className="modal-footer">
          <Button variant="ghost" type="button" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={loading} disabled={!name.trim() || !guildId}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}
