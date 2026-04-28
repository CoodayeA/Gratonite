/**
 * 116. Workflow Automations — IFTTT-style UI for workflow management.
 */
import { useState, useEffect, useCallback, useId } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Zap, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

const TRIGGER_TYPES = [
  { type: 'member_join', label: 'When a member joins' },
  { type: 'member_leave', label: 'When a member leaves' },
  { type: 'message_keyword', label: 'When a message contains keyword' },
  { type: 'reaction_added', label: 'When a reaction is added' },
  { type: 'new_message', label: 'When a new message is posted' },
];

const ACTION_TYPES = [
  { type: 'send_message', label: 'Send a message to channel' },
  { type: 'add_role', label: 'Add a role to user' },
  { type: 'remove_role', label: 'Remove a role from user' },
  { type: 'create_thread', label: 'Create a thread' },
  { type: 'send_dm', label: 'Send a DM to user' },
];

interface Workflow { id: string; name: string; enabled: boolean; triggers: Array<{ type: string; config: Record<string, unknown> }>; actions: Array<{ type: string; config: Record<string, unknown>; orderIndex: number }>; }

export default function WorkflowBuilder({ guildId }: { guildId: string }) {
  const triggerSelectId = useId();
  const actionSelectId = useId();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState(TRIGGER_TYPES[0].type);
  const [actionType, setActionType] = useState(ACTION_TYPES[0].type);
  const { addToast } = useToast();

  const fetch_ = useCallback(async () => {
    try { setWorkflows(await api.workflows.list(guildId)); } catch {}
  }, [guildId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const create = async () => {
    if (!name.trim()) return;
    try {
      await api.workflows.create(guildId, {
        name,
        triggers: [{ type: triggerType }],
        actions: [{ order: 0, type: actionType }],
      });
      setShowCreate(false);
      setName('');
      fetch_();
    } catch { addToast({ title: 'Failed to create workflow', variant: 'error' }); }
  };

  const toggle = async (wf: Workflow) => {
    try { await api.workflows.update(guildId, wf.id, { enabled: !wf.enabled }); fetch_(); } catch { addToast({ title: 'Failed to update workflow', variant: 'error' }); }
  };

  const remove = async (id: string) => {
    try { await api.workflows.delete(guildId, id); fetch_(); } catch { addToast({ title: 'Failed to delete workflow', variant: 'error' }); }
  };

  return (
    <div className="p-4 bg-gray-900 rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400" /> Workflow Automations</h3>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded">
          <Plus className="w-4 h-4" /> New Workflow
        </button>
      </div>

      {showCreate && (
        <div className="p-3 bg-gray-800 rounded-lg space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Workflow name" className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600" />
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label htmlFor={triggerSelectId} className="text-xs text-gray-400 block mb-1">When...</label>
              <select id={triggerSelectId} value={triggerType} onChange={e => setTriggerType(e.target.value)} className="w-full bg-gray-700 text-white text-sm rounded px-2 py-1.5 border border-gray-600">
                {TRIGGER_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
              </select>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-500 mt-4" />
            <div className="flex-1">
              <label htmlFor={actionSelectId} className="text-xs text-gray-400 block mb-1">Then...</label>
              <select id={actionSelectId} value={actionType} onChange={e => setActionType(e.target.value)} className="w-full bg-gray-700 text-white text-sm rounded px-2 py-1.5 border border-gray-600">
                {ACTION_TYPES.map(a => <option key={a.type} value={a.type}>{a.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded">Create</button>
            <button onClick={() => setShowCreate(false)} className="text-sm text-gray-400">Cancel</button>
          </div>
        </div>
      )}

      {workflows.length === 0 ? (
        <p className="text-gray-500 text-sm">No workflows configured. Create one to automate tasks.</p>
      ) : (
        <div className="space-y-2">
          {workflows.map(wf => (
            <div key={wf.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
              <Zap className={`w-5 h-5 ${wf.enabled ? 'text-yellow-400' : 'text-gray-600'}`} />
              <div className="flex-1">
                <p className="text-sm text-white font-medium">{wf.name}</p>
                <p className="text-xs text-gray-500">
                  {wf.triggers?.map(t => TRIGGER_TYPES.find(tt => tt.type === t.type)?.label || t.type).join(', ')}
                  {' -> '}
                  {wf.actions?.map(a => ACTION_TYPES.find(at => at.type === a.type)?.label || a.type).join(', ')}
                </p>
              </div>
              <button onClick={() => toggle(wf)} className="text-gray-400 hover:text-white">
                {wf.enabled ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => remove(wf.id)} className="text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
