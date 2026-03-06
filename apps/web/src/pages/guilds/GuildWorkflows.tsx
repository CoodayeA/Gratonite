import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Trash2, Edit2, Zap, ToggleLeft, ToggleRight, X, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowTrigger {
    id: string;
    type: string;
    config: Record<string, unknown>;
}

interface WorkflowAction {
    id: string;
    orderIndex: number;
    type: string;
    config: Record<string, unknown>;
}

interface Workflow {
    id: string;
    guildId: string;
    name: string;
    enabled: boolean;
    createdBy: string | null;
    createdAt: string;
    triggers: WorkflowTrigger[];
    actions: WorkflowAction[];
}

// ---------------------------------------------------------------------------
// Trigger / Action metadata
// ---------------------------------------------------------------------------

const TRIGGER_OPTIONS = [
    { value: 'member_join', label: 'Member joins server' },
    { value: 'message_sent', label: 'Message sent' },
    { value: 'reaction_added', label: 'Reaction added' },
    { value: 'member_leave', label: 'Member leaves server' },
] as const;

const ACTION_OPTIONS = [
    { value: 'send_message', label: 'Send Message' },
    { value: 'add_role', label: 'Add Role' },
    { value: 'remove_role', label: 'Remove Role' },
    { value: 'create_thread', label: 'Create Thread' },
    { value: 'pin_message', label: 'Pin Message' },
] as const;

type TriggerType = typeof TRIGGER_OPTIONS[number]['value'];
type ActionType = typeof ACTION_OPTIONS[number]['value'];

function triggerLabel(type: string): string {
    return TRIGGER_OPTIONS.find((t) => t.value === type)?.label ?? type;
}

// ---------------------------------------------------------------------------
// Action config fields
// ---------------------------------------------------------------------------

interface ActionConfigProps {
    type: ActionType;
    config: Record<string, string>;
    onChange: (config: Record<string, string>) => void;
}

function ActionConfigFields({ type, config, onChange }: ActionConfigProps) {
    const set = (key: string, value: string) => onChange({ ...config, [key]: value });

    const inputStyle: React.CSSProperties = {
        flex: 1,
        background: 'var(--bg-app)',
        border: '1px solid var(--stroke)',
        borderRadius: 'var(--radius-sm)',
        padding: '6px 10px',
        color: 'var(--text-primary)',
        fontSize: '13px',
        outline: 'none',
    };
    const labelStyle: React.CSSProperties = {
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        marginBottom: '4px',
        display: 'block',
    };

    switch (type) {
        case 'send_message':
            return (
                <>
                    <div>
                        <label style={labelStyle}>Channel ID</label>
                        <input
                            style={inputStyle}
                            placeholder="Channel ID"
                            value={config.channelId ?? ''}
                            onChange={(e) => set('channelId', e.target.value)}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Message Content</label>
                        <textarea
                            style={{ ...inputStyle, minHeight: '60px', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
                            placeholder="Message to send..."
                            value={config.content ?? ''}
                            onChange={(e) => set('content', e.target.value)}
                        />
                    </div>
                </>
            );
        case 'add_role':
        case 'remove_role':
            return (
                <div>
                    <label style={labelStyle}>Role ID</label>
                    <input
                        style={inputStyle}
                        placeholder="Role ID"
                        value={config.roleId ?? ''}
                        onChange={(e) => set('roleId', e.target.value)}
                    />
                </div>
            );
        case 'create_thread':
            return (
                <>
                    <div>
                        <label style={labelStyle}>Channel ID</label>
                        <input
                            style={inputStyle}
                            placeholder="Channel ID"
                            value={config.channelId ?? ''}
                            onChange={(e) => set('channelId', e.target.value)}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Thread Name</label>
                        <input
                            style={inputStyle}
                            placeholder="Thread name"
                            value={config.name ?? ''}
                            onChange={(e) => set('name', e.target.value)}
                        />
                    </div>
                </>
            );
        case 'pin_message':
            return null;
        default:
            return null;
    }
}

// ---------------------------------------------------------------------------
// Form state types
// ---------------------------------------------------------------------------

interface FormTrigger {
    type: TriggerType;
}

interface FormAction {
    type: ActionType;
    config: Record<string, string>;
}

interface WorkflowForm {
    name: string;
    triggers: FormTrigger[];
    actions: FormAction[];
}

function emptyForm(): WorkflowForm {
    return { name: '', triggers: [{ type: 'member_join' }], actions: [] };
}

// ---------------------------------------------------------------------------
// WorkflowForm component
// ---------------------------------------------------------------------------

interface WorkflowFormProps {
    initial?: WorkflowForm;
    onSave: (form: WorkflowForm) => Promise<void>;
    onCancel: () => void;
    saving: boolean;
}

function WorkflowFormPanel({ initial, onSave, onCancel, saving }: WorkflowFormProps) {
    const [form, setForm] = useState<WorkflowForm>(initial ?? emptyForm());

    const setName = (name: string) => setForm((f) => ({ ...f, name }));

    const setTrigger = (i: number, type: TriggerType) =>
        setForm((f) => {
            const triggers = [...f.triggers];
            triggers[i] = { type };
            return { ...f, triggers };
        });

    const addTrigger = () =>
        setForm((f) => ({ ...f, triggers: [...f.triggers, { type: 'member_join' }] }));

    const removeTrigger = (i: number) =>
        setForm((f) => ({ ...f, triggers: f.triggers.filter((_, idx) => idx !== i) }));

    const setActionType = (i: number, type: ActionType) =>
        setForm((f) => {
            const actions = [...f.actions];
            actions[i] = { ...actions[i], type, config: {} };
            return { ...f, actions };
        });

    const setActionConfig = (i: number, config: Record<string, string>) =>
        setForm((f) => {
            const actions = [...f.actions];
            actions[i] = { ...actions[i], config };
            return { ...f, actions };
        });

    const addAction = () =>
        setForm((f) => ({
            ...f,
            actions: [...f.actions, { type: 'send_message', config: {} }],
        }));

    const removeAction = (i: number) =>
        setForm((f) => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));

    const cardStyle: React.CSSProperties = {
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--stroke)',
        borderRadius: 'var(--radius-md, 8px)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    };

    const inputStyle: React.CSSProperties = {
        background: 'var(--bg-app)',
        border: '1px solid var(--stroke)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 12px',
        color: 'var(--text-primary)',
        fontSize: '14px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
    };

    const selectStyle: React.CSSProperties = {
        ...inputStyle,
        cursor: 'pointer',
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        marginBottom: '6px',
        display: 'block',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Name */}
            <div>
                <label style={labelStyle}>Workflow Name</label>
                <input
                    style={inputStyle}
                    placeholder="e.g. Welcome new members"
                    value={form.name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>

            {/* Triggers */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ ...labelStyle, margin: 0 }}>Triggers</label>
                    <button
                        type="button"
                        onClick={addTrigger}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <Plus size={12} /> Add Trigger
                    </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {form.triggers.map((trigger, i) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <select
                                style={{ ...selectStyle, flex: 1 }}
                                value={trigger.type}
                                onChange={(e) => setTrigger(i, e.target.value as TriggerType)}
                            >
                                {TRIGGER_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            {form.triggers.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeTrigger(i)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ ...labelStyle, margin: 0 }}>Actions</label>
                    <button
                        type="button"
                        onClick={addAction}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <Plus size={12} /> Add Action
                    </button>
                </div>
                {form.actions.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' }}>
                        No actions yet. Add one above.
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {form.actions.map((action, i) => (
                        <div key={i} style={cardStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', minWidth: '20px' }}>{i + 1}.</span>
                                <select
                                    style={{ ...selectStyle, flex: 1, padding: '6px 10px' }}
                                    value={action.type}
                                    onChange={(e) => setActionType(i, e.target.value as ActionType)}
                                >
                                    {ACTION_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => removeAction(i)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            <ActionConfigFields
                                type={action.type}
                                config={action.config}
                                onChange={(cfg) => setActionConfig(i, cfg)}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--stroke)' }}>
                <button
                    type="button"
                    onClick={onCancel}
                    style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={saving || !form.name.trim()}
                    onClick={() => onSave(form)}
                    style={{
                        padding: '8px 16px',
                        background: (saving || !form.name.trim()) ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                        color: (saving || !form.name.trim()) ? 'var(--text-muted)' : '#000',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '13px',
                        cursor: (saving || !form.name.trim()) ? 'default' : 'pointer',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}
                >
                    <Check size={14} />
                    {saving ? 'Saving...' : 'Save Workflow'}
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// GuildWorkflows page
// ---------------------------------------------------------------------------

export default function GuildWorkflows() {
    const { guildId } = useParams<{ guildId: string }>();
    const { addToast } = useToast();

    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
    const [saving, setSaving] = useState(false);

    // -----------------------------------------------------------------------
    // Fetch workflows
    // -----------------------------------------------------------------------

    const fetchWorkflows = useCallback(async () => {
        if (!guildId) return;
        setLoading(true);
        try {
            const data = await api.workflows.list(guildId);
            setWorkflows(Array.isArray(data) ? data : []);
        } catch {
            addToast({ title: 'Failed to load automations', variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        void fetchWorkflows();
    }, [fetchWorkflows]);

    // -----------------------------------------------------------------------
    // Create
    // -----------------------------------------------------------------------

    const handleCreate = async (form: WorkflowForm) => {
        if (!guildId) return;
        setSaving(true);
        try {
            await api.workflows.create(guildId, {
                name: form.name,
                triggers: form.triggers.map((t) => ({ type: t.type, config: {} })),
                actions: form.actions.map((a, i) => ({ order: i, type: a.type, config: a.config })),
            });
            addToast({ title: 'Workflow created', variant: 'success' });
            setIsCreating(false);
            await fetchWorkflows();
        } catch {
            addToast({ title: 'Failed to create workflow', variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // -----------------------------------------------------------------------
    // Update
    // -----------------------------------------------------------------------

    const handleUpdate = async (form: WorkflowForm) => {
        if (!guildId || !editingWorkflow) return;
        setSaving(true);
        try {
            await api.workflows.update(guildId, editingWorkflow.id, {
                name: form.name,
                triggers: form.triggers.map((t) => ({ type: t.type, config: {} })),
                actions: form.actions.map((a, i) => ({ order: i, type: a.type, config: a.config })),
            });
            addToast({ title: 'Workflow updated', variant: 'success' });
            setEditingWorkflow(null);
            await fetchWorkflows();
        } catch {
            addToast({ title: 'Failed to update workflow', variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // -----------------------------------------------------------------------
    // Toggle enabled
    // -----------------------------------------------------------------------

    const handleToggle = async (workflow: Workflow) => {
        if (!guildId) return;
        try {
            await api.workflows.update(guildId, workflow.id, { enabled: !workflow.enabled });
            setWorkflows((prev) =>
                prev.map((w) => (w.id === workflow.id ? { ...w, enabled: !w.enabled } : w)),
            );
        } catch {
            addToast({ title: 'Failed to toggle workflow', variant: 'error' });
        }
    };

    // -----------------------------------------------------------------------
    // Delete
    // -----------------------------------------------------------------------

    const handleDelete = async (workflow: Workflow) => {
        if (!guildId) return;
        if (!confirm(`Delete workflow "${workflow.name}"? This cannot be undone.`)) return;
        try {
            await api.workflows.delete(guildId, workflow.id);
            addToast({ title: 'Workflow deleted', variant: 'info' });
            setWorkflows((prev) => prev.filter((w) => w.id !== workflow.id));
        } catch {
            addToast({ title: 'Failed to delete workflow', variant: 'error' });
        }
    };

    // -----------------------------------------------------------------------
    // Derive edit form from workflow
    // -----------------------------------------------------------------------

    function workflowToForm(wf: Workflow): WorkflowForm {
        return {
            name: wf.name,
            triggers: wf.triggers.length > 0
                ? wf.triggers.map((t) => ({ type: t.type as TriggerType }))
                : [{ type: 'member_join' }],
            actions: wf.actions.map((a) => ({
                type: a.type as ActionType,
                config: (a.config ?? {}) as Record<string, string>,
            })),
        };
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    const panelStyle: React.CSSProperties = {
        background: 'var(--bg-elevated)',
        border: '1px solid var(--stroke)',
        borderRadius: 'var(--radius-md, 12px)',
        padding: '24px',
        marginBottom: '16px',
    };

    return (
        <div
            className="main-content-wrapper"
            style={{ flex: 1, overflowY: 'auto', padding: '48px' }}
        >
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '32px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Zap size={28} color="var(--accent-primary)" />
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-display)', margin: 0 }}>
                                Automations
                            </h1>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                Create workflows that respond to events in your portal.
                            </p>
                        </div>
                    </div>
                    {!isCreating && !editingWorkflow && (
                        <button
                            type="button"
                            onClick={() => setIsCreating(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '10px 16px',
                                background: 'var(--accent-primary)',
                                color: '#000',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: 'pointer',
                            }}
                        >
                            <Plus size={16} /> Create Workflow
                        </button>
                    )}
                </div>

                {/* Create form */}
                {isCreating && (
                    <div style={panelStyle}>
                        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', margin: '0 0 20px' }}>
                            New Workflow
                        </h2>
                        <WorkflowFormPanel
                            onSave={handleCreate}
                            onCancel={() => setIsCreating(false)}
                            saving={saving}
                        />
                    </div>
                )}

                {/* Workflow list */}
                {loading ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '48px 0' }}>
                        Loading automations...
                    </div>
                ) : workflows.length === 0 && !isCreating ? (
                    <div
                        style={{
                            textAlign: 'center',
                            padding: '64px 32px',
                            background: 'var(--bg-elevated)',
                            border: '1px dashed var(--stroke)',
                            borderRadius: 'var(--radius-md, 12px)',
                            color: 'var(--text-muted)',
                        }}
                    >
                        <Zap size={40} style={{ marginBottom: '16px', opacity: 0.4 }} />
                        <p style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px' }}>No automations yet</p>
                        <p style={{ fontSize: '13px', margin: 0 }}>
                            Create your first workflow to automate actions in your portal.
                        </p>
                    </div>
                ) : (
                    workflows.map((wf) => {
                        const isEditing = editingWorkflow?.id === wf.id;
                        return (
                            <div key={wf.id} style={panelStyle}>
                                {isEditing ? (
                                    <>
                                        <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px' }}>
                                            Edit Workflow
                                        </h2>
                                        <WorkflowFormPanel
                                            initial={workflowToForm(wf)}
                                            onSave={handleUpdate}
                                            onCancel={() => setEditingWorkflow(null)}
                                            saving={saving}
                                        />
                                    </>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        {/* Toggle */}
                                        <button
                                            type="button"
                                            onClick={() => handleToggle(wf)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: wf.enabled ? 'var(--success)' : 'var(--text-muted)', display: 'flex', flexShrink: 0 }}
                                            title={wf.enabled ? 'Disable' : 'Enable'}
                                        >
                                            {wf.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                        </button>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontWeight: 700, fontSize: '15px' }}>{wf.name}</span>
                                                {!wf.enabled && (
                                                    <span style={{ fontSize: '11px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                                        Disabled
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                {wf.triggers.length > 0
                                                    ? wf.triggers.map((t) => triggerLabel(t.type)).join(', ')
                                                    : 'No triggers'}
                                                {' '}
                                                &mdash; {wf.actions.length} action{wf.actions.length !== 1 ? 's' : ''}
                                            </div>
                                        </div>

                                        {/* Edit + Delete */}
                                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                            <button
                                                type="button"
                                                onClick={() => setEditingWorkflow(wf)}
                                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}
                                            >
                                                <Edit2 size={13} /> Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(wf)}
                                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}
                                            >
                                                <Trash2 size={13} /> Delete
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
