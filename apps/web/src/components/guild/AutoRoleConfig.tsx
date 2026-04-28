import { useState, useEffect, useId } from 'react';
import { UserPlus, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface Role {
  id: string;
  name: string;
  color?: string;
}

interface AutoRoleRule {
  id: string;
  roleId: string;
  triggerType: string;
  triggerValue: number;
  enabled: boolean;
  createdAt: string;
}

interface AutoRoleConfigProps {
  guildId: string;
  roles: Role[];
}

const TRIGGER_LABELS: Record<string, string> = {
  days_in_server: 'Days in server',
  message_count: 'Message count',
  level: 'Level reached',
};

export default function AutoRoleConfig({ guildId, roles }: AutoRoleConfigProps) {
  const roleSelectId = useId();
  const triggerSelectId = useId();
  const triggerValueId = useId();
  const [rules, setRules] = useState<AutoRoleRule[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState('');
  const [triggerType, setTriggerType] = useState('days_in_server');
  const [triggerValue, setTriggerValue] = useState(7);
  const { addToast } = useToast();

  useEffect(() => {
    loadRules();
  }, [guildId]);

  async function loadRules() {
    try {
      const res = await api.get(`/guilds/${guildId}/auto-roles`) as AutoRoleRule[];
      setRules(res);
    } catch {
      addToast({ title: 'Failed to load auto-role rules', variant: 'error' });
    }
  }

  async function handleCreate() {
    if (!roleId) {
      addToast({ title: 'Select a role', variant: 'error' });
      return;
    }
    try {
      await api.post(`/guilds/${guildId}/auto-roles`, {
        roleId,
        triggerType,
        triggerValue,
      });
      addToast({ title: 'Auto-role rule created', variant: 'success' });
      setShowAdd(false);
      resetForm();
      loadRules();
    } catch {
      addToast({ title: 'Failed to create rule', variant: 'error' });
    }
  }

  async function handleUpdate(id: string) {
    try {
      await api.patch(`/guilds/${guildId}/auto-roles/${id}`, {
        roleId,
        triggerType,
        triggerValue,
      });
      addToast({ title: 'Rule updated', variant: 'success' });
      setEditingId(null);
      resetForm();
      loadRules();
    } catch {
      addToast({ title: 'Failed to update rule', variant: 'error' });
    }
  }

  async function handleToggle(rule: AutoRoleRule) {
    try {
      await api.patch(`/guilds/${guildId}/auto-roles/${rule.id}`, {
        enabled: !rule.enabled,
      });
      loadRules();
    } catch {
      addToast({ title: 'Failed to toggle rule', variant: 'error' });
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/guilds/${guildId}/auto-roles/${id}`);
      addToast({ title: 'Rule deleted', variant: 'success' });
      loadRules();
    } catch {
      addToast({ title: 'Failed to delete rule', variant: 'error' });
    }
  }

  function startEdit(rule: AutoRoleRule) {
    setEditingId(rule.id);
    setRoleId(rule.roleId);
    setTriggerType(rule.triggerType);
    setTriggerValue(rule.triggerValue);
  }

  function resetForm() {
    setRoleId('');
    setTriggerType('days_in_server');
    setTriggerValue(7);
  }

  function renderForm(onSubmit: () => void, submitLabel: string) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 space-y-3">
        <div>
          <label htmlFor={roleSelectId} className="text-sm text-gray-400 block mb-1">Role to assign</label>
          <select
            id={roleSelectId}
            value={roleId}
            onChange={e => setRoleId(e.target.value)}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
          >
            <option value="">Select role...</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={triggerSelectId} className="text-sm text-gray-400 block mb-1">Trigger</label>
          <select
            id={triggerSelectId}
            value={triggerType}
            onChange={e => setTriggerType(e.target.value)}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
          >
            <option value="days_in_server">Days in server</option>
            <option value="message_count">Message count</option>
            <option value="level">Level reached</option>
          </select>
        </div>

        <div>
          <label htmlFor={triggerValueId} className="text-sm text-gray-400 block mb-1">
            {triggerType === 'days_in_server' ? 'Days' : triggerType === 'message_count' ? 'Messages' : 'Level'}
          </label>
          <input
            id={triggerValueId}
            type="number"
            min={1}
            value={triggerValue}
            onChange={e => setTriggerValue(Number(e.target.value))}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onSubmit}
            className="flex-1 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 text-sm font-medium"
          >
            {submitLabel}
          </button>
          <button
            onClick={() => { setShowAdd(false); setEditingId(null); resetForm(); }}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <UserPlus className="w-5 h-5" /> Auto-Roles
        </h3>
        {!showAdd && !editingId && (
          <button
            onClick={() => { setShowAdd(true); resetForm(); }}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-500 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add Rule
          </button>
        )}
      </div>

      {showAdd && renderForm(handleCreate, 'Create Rule')}

      <div className="space-y-2">
        {rules.map(rule => (
          <div key={rule.id}>
            {editingId === rule.id ? (
              renderForm(() => handleUpdate(rule.id), 'Save Changes')
            ) : (
              <div className={`bg-gray-800 rounded-lg p-3 flex items-center justify-between ${!rule.enabled ? 'opacity-50' : ''}`}>
                <div>
                  <p className="text-sm text-white">
                    {roles.find(r => r.id === rule.roleId)?.name || 'Unknown role'}
                  </p>
                  <p className="text-xs text-gray-500">
                    When {TRIGGER_LABELS[rule.triggerType] || rule.triggerType} reaches {rule.triggerValue}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(rule)}
                    className={`w-9 h-5 rounded-full transition-colors ${rule.enabled ? 'bg-indigo-600' : 'bg-gray-600'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <button onClick={() => startEdit(rule)} className="text-gray-400 hover:text-gray-200">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(rule.id)} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {rules.length === 0 && !showAdd && (
          <p className="text-sm text-gray-500 text-center py-4">
            No auto-role rules configured. Add one to automatically assign roles.
          </p>
        )}
      </div>
    </div>
  );
}
