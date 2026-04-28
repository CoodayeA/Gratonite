import { useState, useEffect, useId } from 'react';
import { Shield, Plus, Trash2, Smile } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface RoleMapping {
  emoji: string;
  roleId: string;
  roleName?: string;
}

interface ReactionRoleMessage {
  id: string;
  messageId: string;
  channelId: string;
  mode: string;
  mappings: RoleMapping[];
  createdAt: string;
}

interface Role {
  id: string;
  name: string;
  color?: string;
}

interface ReactionRoleBuilderProps {
  guildId: string;
  roles: Role[];
  channels: { id: string; name: string }[];
}

const COMMON_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟',
  '✅', '❌', '⭐', '🎮', '🎵', '🎨', '💻', '📚', '🏆', '💬'];

export default function ReactionRoleBuilder({ guildId, roles, channels }: ReactionRoleBuilderProps) {
  const baseId = useId();
  const channelSelectId = `${baseId}-channel`;
  const messageInputId = `${baseId}-message`;
  const modeSelectId = `${baseId}-mode`;
  const [reactionRoles, setReactionRoles] = useState<ReactionRoleMessage[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [messageId, setMessageId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [mode, setMode] = useState<'single' | 'multi' | 'verify'>('multi');
  const [mappings, setMappings] = useState<RoleMapping[]>([{ emoji: '✅', roleId: '' }]);
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    loadReactionRoles();
  }, [guildId]);

  async function loadReactionRoles() {
    try {
      const res = await api.get(`/guilds/${guildId}/reaction-roles`) as ReactionRoleMessage[];
      setReactionRoles(res);
    } catch {
      addToast({ title: 'Failed to load reaction roles', variant: 'error' });
    }
  }

  async function handleCreate() {
    if (!messageId || !channelId || mappings.some(m => !m.roleId)) {
      addToast({ title: 'Fill in all fields', variant: 'error' });
      return;
    }
    try {
      await api.post(`/guilds/${guildId}/reaction-roles`, {
        messageId,
        channelId,
        mode,
        mappings: mappings.map(m => ({ emoji: m.emoji, roleId: m.roleId })),
      });
      addToast({ title: 'Reaction role created', variant: 'success' });
      setShowCreate(false);
      setMessageId('');
      setChannelId('');
      setMappings([{ emoji: '✅', roleId: '' }]);
      loadReactionRoles();
    } catch {
      addToast({ title: 'Failed to create reaction role', variant: 'error' });
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/guilds/${guildId}/reaction-roles/${id}`);
      addToast({ title: 'Reaction role deleted', variant: 'success' });
      loadReactionRoles();
    } catch {
      addToast({ title: 'Failed to delete', variant: 'error' });
    }
  }

  function addMapping() {
    setMappings([...mappings, { emoji: '⭐', roleId: '' }]);
  }

  function removeMapping(index: number) {
    setMappings(mappings.filter((_, i) => i !== index));
  }

  function updateMapping(index: number, field: keyof RoleMapping, value: string) {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };
    setMappings(updated);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5" /> Reaction Roles
        </h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-500"
        >
          {showCreate ? 'Cancel' : 'Create New'}
        </button>
      </div>

      {showCreate && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <div>
            <label htmlFor={channelSelectId} className="text-sm text-gray-400 block mb-1">Channel</label>
            <select
              id={channelSelectId}
              value={channelId}
              onChange={e => setChannelId(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
            >
              <option value="">Select channel...</option>
              {channels.map(c => (
                <option key={c.id} value={c.id}># {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={messageInputId} className="text-sm text-gray-400 block mb-1">Message ID</label>
            <input
              id={messageInputId}
              type="text"
              value={messageId}
              onChange={e => setMessageId(e.target.value)}
              placeholder="Paste message ID"
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor={modeSelectId} className="text-sm text-gray-400 block mb-1">Mode</label>
            <select
              id={modeSelectId}
              value={mode}
              onChange={e => setMode(e.target.value as 'single' | 'multi' | 'verify')}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
            >
              <option value="multi">Multiple roles</option>
              <option value="single">Single role only</option>
              <option value="verify">Verification (any reaction)</option>
            </select>
          </div>

          <div>
            <div className="text-sm text-gray-400 block mb-1">Emoji → Role Mappings</div>
            <div className="space-y-2">
              {mappings.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowEmojiPicker(showEmojiPicker === i ? null : i)}
                      className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center text-lg hover:bg-gray-600"
                    >
                      {m.emoji || <Smile className="w-4 h-4 text-gray-400" />}
                    </button>
                    {showEmojiPicker === i && (
                      <div className="absolute z-10 top-12 left-0 bg-gray-700 rounded-lg p-2 grid grid-cols-5 gap-1 shadow-xl">
                        {COMMON_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => { updateMapping(i, 'emoji', emoji); setShowEmojiPicker(null); }}
                            className="w-8 h-8 hover:bg-gray-600 rounded flex items-center justify-center"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <select
                    value={m.roleId}
                    onChange={e => updateMapping(i, 'roleId', e.target.value)}
                    className="flex-1 bg-gray-700 text-white rounded px-3 py-2 text-sm"
                  >
                    <option value="">Select role...</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>

                  {mappings.length > 1 && (
                    <button onClick={() => removeMapping(i)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addMapping}
              className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add mapping
            </button>
          </div>

          <div className="bg-gray-900 rounded p-3">
            <p className="text-xs text-gray-500 mb-2">Preview</p>
            <div className="text-sm text-gray-300">
              <p className="mb-1 font-medium">React to get your roles!</p>
              {mappings.filter(m => m.roleId).map((m, i) => (
                <p key={i} className="text-gray-400">
                  {m.emoji} → {roles.find(r => r.id === m.roleId)?.name || 'Unknown role'}
                </p>
              ))}
              <p className="text-xs text-gray-600 mt-1">
                Mode: {mode === 'single' ? 'Pick one' : mode === 'verify' ? 'Any reaction to verify' : 'Pick multiple'}
              </p>
            </div>
          </div>

          <button
            onClick={handleCreate}
            className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 text-sm font-medium"
          >
            Create Reaction Roles
          </button>
        </div>
      )}

      <div className="space-y-2">
        {reactionRoles.map(rr => (
          <div key={rr.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-white">
                {rr.mappings?.map((m, i) => (
                  <span key={i} className="bg-gray-700 px-2 py-0.5 rounded">
                    {m.emoji}
                  </span>
                ))}
                <span className="text-gray-500">({rr.mode})</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {rr.mappings?.length || 0} mapping(s)
              </p>
            </div>
            <button
              onClick={() => handleDelete(rr.id)}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {reactionRoles.length === 0 && !showCreate && (
          <p className="text-sm text-gray-500 text-center py-4">
            No reaction roles configured. Create one to get started.
          </p>
        )}
      </div>
    </div>
  );
}
