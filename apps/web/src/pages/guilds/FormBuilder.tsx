import { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, GripVertical, Eye, ChevronDown, ChevronUp, Check, X, Settings } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

type FieldType = 'short_text' | 'long_text' | 'multiple_choice' | 'checkbox' | 'dropdown';

type FormField = {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: string[];
};

type Form = {
  id: string;
  guildId: string;
  title: string;
  description: string | null;
  fields: FormField[];
  responseChannelId: string | null;
  roleOnApproval: string | null;
  status: 'open' | 'closed';
  createdBy: string;
  createdAt: string;
};

type FormResponse = {
  id: string;
  formId: string;
  userId: string;
  answers: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  username: string;
  displayName: string;
};

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'dropdown', label: 'Dropdown' },
];

const genId = () => Math.random().toString(36).slice(2, 10);

const FormBuilder = ({ guildId, isAdmin }: { guildId: string; isAdmin?: boolean }) => {
  const [forms, setForms] = useState<Form[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'fill' | 'responses'>('list');
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [responsesTotal, setResponsesTotal] = useState(0);
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  // Builder state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [preview, setPreview] = useState(false);

  // Fill state
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  useEffect(() => { loadForms(); }, [guildId]);

  const loadForms = async () => {
    setLoading(true);
    try {
      const res = await api.forms.list(guildId);
      setForms(res as Form[]);
    } catch { addToast({ title: 'Failed to load forms', variant: 'error' }); }
    setLoading(false);
  };

  const createForm = async () => {
    if (!formTitle) { addToast({ title: 'Title is required', variant: 'error' }); return; }
    try {
      await api.forms.create(guildId, {
        title: formTitle, description: formDesc || undefined, fields,
      });
      setView('list');
      setFormTitle(''); setFormDesc(''); setFields([]);
      loadForms();
      addToast({ title: 'Form created!', variant: 'success' });
    } catch { addToast({ title: 'Failed to create form', variant: 'error' }); }
  };

  const deleteForm = async (id: string) => {
    try {
      await api.forms.delete(guildId, id);
      loadForms();
      addToast({ title: 'Form deleted', variant: 'info' });
    } catch { addToast({ title: 'Failed to delete form', variant: 'error' }); }
  };

  const openFill = (form: Form) => {
    setSelectedForm(form);
    setAnswers({});
    setView('fill');
  };

  const submitResponse = async () => {
    if (!selectedForm) return;
    try {
      await api.forms.submitResponse(guildId, selectedForm.id, answers);
      setView('list');
      addToast({ title: 'Response submitted!', variant: 'success' });
    } catch { addToast({ title: 'Failed to submit response', variant: 'error' }); }
  };

  const openResponses = async (form: Form) => {
    setSelectedForm(form);
    setView('responses');
    try {
      const res = await api.forms.listResponses(guildId, form.id) as any;
      setResponses(Array.isArray(res) ? res : ((res as any).responses ?? []) as any[]);
      setResponsesTotal(Array.isArray(res) ? res.length : ((res as Record<string, unknown>).total ?? 0) as number);
    } catch { addToast({ title: 'Failed to load responses', variant: 'error' }); }
  };

  const reviewResponse = async (responseId: string, status: 'approved' | 'rejected') => {
    if (!selectedForm) return;
    try {
      await api.forms.reviewResponse(guildId, selectedForm.id, responseId, { status });
      setResponses(prev => prev.map(r => r.id === responseId ? { ...r, status } : r));
      addToast({ title: `Response ${status}`, variant: 'success' });
    } catch { addToast({ title: 'Failed to review response', variant: 'error' }); }
  };

  const addField = () => {
    setFields([...fields, { id: genId(), type: 'short_text', label: '', required: false }]);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const renderFieldInput = (field: FormField, value: unknown, onChange: (v: unknown) => void) => {
    switch (field.type) {
      case 'short_text':
        return <input type="text" value={(value as string) || ''} onChange={e => onChange(e.target.value)}
          style={{ width: '100%', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: 4, padding: '8px 12px', fontSize: 14, border: '1px solid var(--border)', outline: 'none', boxSizing: 'border-box' }} />;
      case 'long_text':
        return <textarea value={(value as string) || ''} onChange={e => onChange(e.target.value)} rows={3}
          style={{ width: '100%', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: 4, padding: '8px 12px', fontSize: 14, border: '1px solid var(--border)', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />;
      case 'multiple_choice':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(field.options || []).map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
                <input type="radio" name={field.id} checked={value === opt} onChange={() => onChange(opt)} /> {opt}
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(field.options || []).map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={((value as string[]) || []).includes(opt)}
                  onChange={e => {
                    const arr = ((value as string[]) || []);
                    onChange(e.target.checked ? [...arr, opt] : arr.filter(v => v !== opt));
                  }} /> {opt}
              </label>
            ))}
          </div>
        );
      case 'dropdown':
        return (
          <select value={(value as string) || ''} onChange={e => onChange(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', borderRadius: 4, padding: '8px 12px', fontSize: 14, border: '1px solid var(--border)', outline: 'none', boxSizing: 'border-box' }}>
            <option value="">Select...</option>
            {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
    }
  };

  // --- LIST VIEW ---
  if (view === 'list') return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={20} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Forms & Applications</h2>
        </div>
        {isAdmin && (
          <button onClick={() => setView('create')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--accent)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: 8, fontSize: 14, border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}>
            <Plus size={14} /> New Form
          </button>
        )}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0' }}>Loading forms...</div>
      ) : forms.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0' }}>No forms created yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {forms.map(form => (
            <div key={form.id} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{form.title}</h3>
                    <span style={{
                      fontSize: 12, padding: '2px 6px', borderRadius: 4,
                      background: form.status === 'open' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                      color: form.status === 'open' ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {form.status}
                    </span>
                  </div>
                  {form.description && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, margin: '4px 0 0 0' }}>{form.description}</p>}
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, margin: '4px 0 0 0' }}>{(form.fields as FormField[]).length} fields</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {form.status === 'open' && (
                    <button onClick={() => openFill(form)}
                      style={{ fontSize: 12, background: 'var(--accent)', color: 'var(--text-primary)', padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}>
                      Fill Out
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button onClick={() => openResponses(form)}
                        style={{ fontSize: 12, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}>
                        Responses
                      </button>
                      <button onClick={() => deleteForm(form.id)} style={{ padding: 4, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}>
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // --- CREATE VIEW ---
  if (view === 'create') return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Create Form</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setPreview(!preview)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}>
            <Eye size={14} /> {preview ? 'Edit' : 'Preview'}
          </button>
          <button onClick={() => setView('list')} style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Editor — always visible */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, ...(preview ? { flex: '0 0 460px' } : { flex: 1, maxWidth: 512, margin: '0 auto' }) }}>
          <input placeholder="Form title" value={formTitle} onChange={e => setFormTitle(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderRadius: 4, padding: '8px 12px', fontSize: 14, border: '1px solid var(--border)', outline: 'none', boxSizing: 'border-box' }} />
          <textarea placeholder="Description (optional)" value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={2}
            style={{ width: '100%', background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderRadius: 4, padding: '8px 12px', fontSize: 14, border: '1px solid var(--border)', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {fields.map((field, idx) => (
              <div key={field.id} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <GripVertical size={14} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>#{idx + 1}</span>
                  <select value={field.type} onChange={e => updateField(field.id, { type: e.target.value as FieldType })}
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', borderRadius: 4, padding: '4px 8px', fontSize: 12, border: '1px solid var(--border)', outline: 'none' }}>
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <div style={{ flex: 1 }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })} /> Required
                  </label>
                  <button onClick={() => removeField(field.id)} style={{ padding: 4, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
                <input placeholder="Field label" value={field.label} onChange={e => updateField(field.id, { label: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: 4, padding: '6px 12px', fontSize: 14, border: '1px solid var(--border)', outline: 'none', boxSizing: 'border-box' }} />
                {['multiple_choice', 'checkbox', 'dropdown'].includes(field.type) && (
                  <div style={{ marginTop: 8 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Options (one per line)</label>
                    <textarea
                      value={(field.options || []).join('\n')}
                      onChange={e => updateField(field.id, { options: e.target.value.split('\n').filter(Boolean) })}
                      rows={3}
                      style={{ width: '100%', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: 4, padding: '6px 12px', fontSize: 12, border: '1px solid var(--border)', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                      placeholder="Option 1&#10;Option 2&#10;Option 3"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <button onClick={addField}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'opacity 0.15s' }}>
            <Plus size={14} /> Add Field
          </button>

          <button onClick={createForm}
            style={{ width: '100%', background: 'var(--accent)', color: 'var(--text-primary)', padding: '8px 0', borderRadius: 8, fontSize: 14, border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}>
            Create Form
          </button>
        </div>

        {/* Live preview panel — shown alongside editor when preview=true */}
        {preview && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 8 }}>Live Preview</div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 24, border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, marginTop: 0 }}>{formTitle || 'Untitled Form'}</h3>
              {formDesc && <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, marginTop: 0 }}>{formDesc}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {fields.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Add fields to see preview</p>
                ) : fields.map(field => (
                  <div key={field.id}>
                    <label style={{ display: 'block', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      {field.label || 'Untitled field'} {field.required && <span style={{ color: 'var(--danger)' }}>*</span>}
                    </label>
                    {renderFieldInput(field, null, () => {})}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // --- FILL VIEW ---
  if (view === 'fill' && selectedForm) return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <button onClick={() => setView('list')} style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, padding: 0 }}>&larr; Back to forms</button>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 24, border: '1px solid var(--border)', maxWidth: 512, margin: '0 auto' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, marginTop: 0 }}>{selectedForm.title}</h3>
        {selectedForm.description && <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, marginTop: 0 }}>{selectedForm.description}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(selectedForm.fields as FormField[]).map(field => (
            <div key={field.id}>
              <label style={{ display: 'block', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {field.label} {field.required && <span style={{ color: 'var(--danger)' }}>*</span>}
              </label>
              {renderFieldInput(field, answers[field.id], v => setAnswers(prev => ({ ...prev, [field.id]: v })))}
            </div>
          ))}
        </div>
        <button onClick={submitResponse}
          style={{ width: '100%', marginTop: 16, background: 'var(--accent)', color: 'var(--text-primary)', padding: '8px 0', borderRadius: 8, fontSize: 14, border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}>
          Submit
        </button>
      </div>
    </div>
  );

  // --- RESPONSES VIEW ---
  if (view === 'responses' && selectedForm) return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <button onClick={() => setView('list')} style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, padding: 0 }}>&larr; Back to forms</button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{selectedForm.title} - Responses ({responsesTotal})</h2>
      </div>
      {responses.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0' }}>No responses yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {responses.map(r => (
            <div key={r.id} style={{ background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setExpandedResponse(expandedResponse === r.id ? null : r.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{r.displayName || r.username}</span>
                  <span style={{
                    fontSize: 12, padding: '2px 6px', borderRadius: 4,
                    background: r.status === 'approved' ? 'rgba(34,197,94,0.2)' : r.status === 'rejected' ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)',
                    color: r.status === 'approved' ? 'var(--success)' : r.status === 'rejected' ? 'var(--danger)' : 'var(--warning)'
                  }}>
                    {r.status}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {r.status === 'pending' && (
                    <>
                      <button onClick={e => { e.stopPropagation(); reviewResponse(r.id, 'approved'); }}
                        style={{ padding: 4, color: 'var(--success)', background: 'none', border: 'none', cursor: 'pointer' }}><Check size={16} /></button>
                      <button onClick={e => { e.stopPropagation(); reviewResponse(r.id, 'rejected'); }}
                        style={{ padding: 4, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                    </>
                  )}
                  {expandedResponse === r.id ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                </div>
              </div>
              {expandedResponse === r.id && (
                <div style={{ borderTop: '1px solid var(--border)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(selectedForm.fields as FormField[]).map(field => (
                    <div key={field.id}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{field.label}</div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                        {Array.isArray((r.answers as Record<string, unknown>)[field.id])
                          ? ((r.answers as Record<string, unknown>)[field.id] as string[]).join(', ')
                          : String((r.answers as Record<string, unknown>)[field.id] ?? '-')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return null;
};

export default FormBuilder;
