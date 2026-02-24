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

        <Input
          label="Channel Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="general"
          maxLength={100}
          required
          autoFocus
        />

        <div className="input-group">
          <label className="input-label">Channel Type</label>
          <div className="input-wrapper">
            <select
              className="input-field"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value={GUILD_TEXT}>Text</option>
              <option value={GUILD_VOICE}>Voice</option>
              <option value={GUILD_CATEGORY}>Category</option>
            </select>
          </div>
        </div>

        {type !== GUILD_CATEGORY && (
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

        {type !== GUILD_CATEGORY && (
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

        {type !== GUILD_CATEGORY && (
          <label className="channel-private-toggle">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(event) => setIsPrivate(event.target.checked)}
            />
            <span>Private channel</span>
          </label>
        )}

        {type !== GUILD_CATEGORY && (
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
