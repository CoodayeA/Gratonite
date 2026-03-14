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
      const res = await api.forms.listResponses(guildId, form.id) as Record<string, unknown> | unknown[];
      setResponses(Array.isArray(res) ? res : ((res as Record<string, unknown>).responses ?? []) as unknown[]);
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
          className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600" />;
      case 'long_text':
        return <textarea value={(value as string) || ''} onChange={e => onChange(e.target.value)} rows={3}
          className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 resize-none" />;
      case 'multiple_choice':
        return (
          <div className="space-y-1">
            {(field.options || []).map(opt => (
              <label key={opt} className="flex items-center gap-2 text-sm text-gray-300">
                <input type="radio" name={field.id} checked={value === opt} onChange={() => onChange(opt)}
                  className="bg-gray-700 border-gray-600" /> {opt}
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <div className="space-y-1">
            {(field.options || []).map(opt => (
              <label key={opt} className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={((value as string[]) || []).includes(opt)}
                  onChange={e => {
                    const arr = ((value as string[]) || []);
                    onChange(e.target.checked ? [...arr, opt] : arr.filter(v => v !== opt));
                  }}
                  className="rounded bg-gray-700 border-gray-600" /> {opt}
              </label>
            ))}
          </div>
        );
      case 'dropdown':
        return (
          <select value={(value as string) || ''} onChange={e => onChange(e.target.value)}
            className="w-full bg-gray-700 text-gray-300 rounded px-3 py-2 text-sm border border-gray-600">
            <option value="">Select...</option>
            {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
    }
  };

  // --- LIST VIEW ---
  if (view === 'list') return (
    <div className="p-6 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-indigo-400" />
          <h2 className="text-lg font-bold text-white">Forms & Applications</h2>
        </div>
        {isAdmin && (
          <button onClick={() => setView('create')}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors">
            <Plus size={14} /> New Form
          </button>
        )}
      </div>
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading forms...</div>
      ) : forms.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No forms created yet</div>
      ) : (
        <div className="space-y-3">
          {forms.map(form => (
            <div key={form.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{form.title}</h3>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${form.status === 'open' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                      {form.status}
                    </span>
                  </div>
                  {form.description && <p className="text-xs text-gray-400 mt-1">{form.description}</p>}
                  <p className="text-xs text-gray-500 mt-1">{(form.fields as FormField[]).length} fields</p>
                </div>
                <div className="flex items-center gap-2">
                  {form.status === 'open' && (
                    <button onClick={() => openFill(form)}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded transition-colors">
                      Fill Out
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button onClick={() => openResponses(form)}
                        className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded transition-colors">
                        Responses
                      </button>
                      <button onClick={() => deleteForm(form.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
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
    <div className="p-6 h-full overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-white">Create Form</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setPreview(!preview)}
            className="flex items-center gap-1 text-xs bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded transition-colors">
            <Eye size={14} /> {preview ? 'Edit' : 'Preview'}
          </button>
          <button onClick={() => setView('list')} className="text-xs text-gray-400 hover:text-gray-200">Cancel</button>
        </div>
      </div>

      {preview ? (
        /* Preview mode */
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 max-w-lg mx-auto">
          <h3 className="text-lg font-bold text-white mb-1">{formTitle || 'Untitled Form'}</h3>
          {formDesc && <p className="text-sm text-gray-400 mb-4">{formDesc}</p>}
          <div className="space-y-4">
            {fields.map(field => (
              <div key={field.id}>
                <label className="block text-sm text-gray-300 mb-1">
                  {field.label || 'Untitled field'} {field.required && <span className="text-red-400">*</span>}
                </label>
                {renderFieldInput(field, null, () => {})}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Edit mode */
        <div className="space-y-4 max-w-lg mx-auto">
          <input placeholder="Form title" value={formTitle} onChange={e => setFormTitle(e.target.value)}
            className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm border border-gray-700 placeholder-gray-500" />
          <textarea placeholder="Description (optional)" value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={2}
            className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm border border-gray-700 placeholder-gray-500 resize-none" />

          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div key={field.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <GripVertical size={14} className="text-gray-500" />
                  <span className="text-xs text-gray-500">#{idx + 1}</span>
                  <select value={field.type} onChange={e => updateField(field.id, { type: e.target.value as FieldType })}
                    className="bg-gray-700 text-gray-300 rounded px-2 py-1 text-xs border border-gray-600">
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <div className="flex-1" />
                  <label className="flex items-center gap-1 text-xs text-gray-400">
                    <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })}
                      className="rounded bg-gray-700 border-gray-600" /> Required
                  </label>
                  <button onClick={() => removeField(field.id)} className="p-1 text-gray-500 hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                </div>
                <input placeholder="Field label" value={field.label} onChange={e => updateField(field.id, { label: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded px-3 py-1.5 text-sm border border-gray-600 placeholder-gray-500" />
                {['multiple_choice', 'checkbox', 'dropdown'].includes(field.type) && (
                  <div className="mt-2">
                    <label className="text-xs text-gray-400 mb-1 block">Options (one per line)</label>
                    <textarea
                      value={(field.options || []).join('\n')}
                      onChange={e => updateField(field.id, { options: e.target.value.split('\n').filter(Boolean) })}
                      rows={3}
                      className="w-full bg-gray-700 text-white rounded px-3 py-1.5 text-xs border border-gray-600 resize-none placeholder-gray-500"
                      placeholder="Option 1&#10;Option 2&#10;Option 3"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <button onClick={addField}
            className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            <Plus size={14} /> Add Field
          </button>

          <button onClick={createForm}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm transition-colors">
            Create Form
          </button>
        </div>
      )}
    </div>
  );

  // --- FILL VIEW ---
  if (view === 'fill' && selectedForm) return (
    <div className="p-6 h-full overflow-auto">
      <button onClick={() => setView('list')} className="text-xs text-gray-400 hover:text-gray-200 mb-4">&larr; Back to forms</button>
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 max-w-lg mx-auto">
        <h3 className="text-lg font-bold text-white mb-1">{selectedForm.title}</h3>
        {selectedForm.description && <p className="text-sm text-gray-400 mb-4">{selectedForm.description}</p>}
        <div className="space-y-4">
          {(selectedForm.fields as FormField[]).map(field => (
            <div key={field.id}>
              <label className="block text-sm text-gray-300 mb-1">
                {field.label} {field.required && <span className="text-red-400">*</span>}
              </label>
              {renderFieldInput(field, answers[field.id], v => setAnswers(prev => ({ ...prev, [field.id]: v })))}
            </div>
          ))}
        </div>
        <button onClick={submitResponse}
          className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm transition-colors">
          Submit
        </button>
      </div>
    </div>
  );

  // --- RESPONSES VIEW ---
  if (view === 'responses' && selectedForm) return (
    <div className="p-6 h-full overflow-auto">
      <button onClick={() => setView('list')} className="text-xs text-gray-400 hover:text-gray-200 mb-4">&larr; Back to forms</button>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">{selectedForm.title} - Responses ({responsesTotal})</h2>
      </div>
      {responses.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No responses yet</div>
      ) : (
        <div className="space-y-2">
          {responses.map(r => (
            <div key={r.id} className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-3 flex items-center justify-between cursor-pointer" onClick={() => setExpandedResponse(expandedResponse === r.id ? null : r.id)}>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white">{r.displayName || r.username}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${r.status === 'approved' ? 'bg-green-600/20 text-green-400' : r.status === 'rejected' ? 'bg-red-600/20 text-red-400' : 'bg-yellow-600/20 text-yellow-400'}`}>
                    {r.status}
                  </span>
                  <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  {r.status === 'pending' && (
                    <>
                      <button onClick={e => { e.stopPropagation(); reviewResponse(r.id, 'approved'); }}
                        className="p-1 text-green-400 hover:text-green-300"><Check size={16} /></button>
                      <button onClick={e => { e.stopPropagation(); reviewResponse(r.id, 'rejected'); }}
                        className="p-1 text-red-400 hover:text-red-300"><X size={16} /></button>
                    </>
                  )}
                  {expandedResponse === r.id ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                </div>
              </div>
              {expandedResponse === r.id && (
                <div className="border-t border-gray-700 p-3 space-y-2">
                  {(selectedForm.fields as FormField[]).map(field => (
                    <div key={field.id}>
                      <div className="text-xs text-gray-400">{field.label}</div>
                      <div className="text-sm text-gray-200">
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
